-- Invitation hardening (real-user edge-case review):
--  1. invitations expire after 14 days — accept and my_invitations() ignore them
--  2. re-inviting an email whose previous invitation expired replaces it
--  3. revoke_invitation(): pending invitations can be cancelled (frees the
--     email for a corrected re-invite; Phase 1 gates this on platform.member.manage)
--  4. accepting into a soft-deleted company is rejected

set check_function_bodies = off;

-- 1 + 2: invite_member replaces expired pending invitations
create or replace function public.invite_member(target_company_id uuid, invitee_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  token uuid;
  normalized_email text := lower(trim(invitee_email));
begin
  if not public.auth_aal2() or not public.is_company_member(target_company_id) then
    raise exception 'not an active member of this company' using errcode = '42501';
  end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email' using errcode = '22000';
  end if;
  if exists (
    select 1
    from public.company_members m
    join auth.users u on u.id = m.user_id
    where m.company_id = target_company_id
      and lower(u.email) = normalized_email
  ) then
    raise exception 'already a member' using errcode = '23505';
  end if;

  -- an expired pending invitation no longer blocks the email
  delete from public.company_members m
  where m.company_id = target_company_id
    and m.user_id is null
    and m.status = 'invited'
    and lower(m.invited_email) = normalized_email
    and m.created_at <= now() - interval '14 days';

  insert into public.company_members (company_id, status, invited_by, invited_email, invite_token)
  values (target_company_id, 'invited', (select auth.uid()), normalized_email, gen_random_uuid())
  returning invite_token into token;

  return token;
end;
$$;

-- 1 + 4: accept ignores expired invitations and soft-deleted companies
create or replace function public.accept_invitation(token uuid)
returns table (company_id uuid, company_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.company_members%rowtype;
  caller_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if (select auth.uid()) is null or not public.auth_aal2() then
    raise exception 'aal2 session required' using errcode = '42501';
  end if;

  select * into invitation
  from public.company_members m
  where m.invite_token = token
    and m.user_id is null
    and m.status = 'invited'
    and m.created_at > now() - interval '14 days'
    and exists (
      select 1 from public.companies c
      where c.id = m.company_id and c.deleted_at is null
    );

  if not found then
    raise exception 'invitation not found, expired or already used' using errcode = 'P0002';
  end if;
  if lower(invitation.invited_email) <> caller_email then
    raise exception 'invitation was sent to a different email' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.company_members m
    where m.company_id = invitation.company_id and m.user_id = (select auth.uid())
  ) then
    raise exception 'already a member' using errcode = '23505';
  end if;

  update public.company_members m
  set user_id = (select auth.uid()),
      status = 'active',
      joined_at = now(),
      invite_token = null
  where m.id = invitation.id;

  return query
    select c.id, c.slug from public.companies c where c.id = invitation.company_id;
end;
$$;

-- 1: the invitee's home screen hides expired invitations too
create or replace function public.my_invitations()
returns table (invite_token uuid, company_name text, invited_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.invite_token, c.name, m.created_at
  from public.company_members m
  join public.companies c on c.id = m.company_id
  where m.user_id is null
    and m.status = 'invited'
    and m.created_at > now() - interval '14 days'
    and lower(m.invited_email) = lower(coalesce(auth.jwt()->>'email', ''))
    and public.auth_aal2()
    and c.deleted_at is null
  order by m.created_at desc
$$;

-- 3: revoke a pending invitation (Phase 0: any active member — mirrors invite rights)
create or replace function public.revoke_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.company_members%rowtype;
begin
  select * into invitation
  from public.company_members m
  where m.id = invitation_id and m.user_id is null and m.status = 'invited';

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  if not public.auth_aal2() or not public.is_company_member(invitation.company_id) then
    raise exception 'not an active member of this company' using errcode = '42501';
  end if;

  delete from public.company_members m where m.id = invitation.id;
end;
$$;

revoke execute on function public.revoke_invitation(uuid) from anon, public;
grant execute on function public.revoke_invitation(uuid) to authenticated;
