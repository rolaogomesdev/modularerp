-- Phase 1 tightening (02-tenancy-and-identity.md): invite/revoke now require
-- platform.member.manage — the Phase 0 "any active member can invite" stub
-- retires. authorize() implies AAL2 and active membership.

set check_function_bodies = off;

create or replace function public.invite_member(target_company_id uuid, invitee_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  token uuid;
  new_invitation_id uuid;
  normalized_email text := lower(trim(invitee_email));
begin
  if not (select public.authorize('platform.member.manage', target_company_id)) then
    raise exception 'requires platform.member.manage' using errcode = '42501';
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

  delete from public.company_members m
  where m.company_id = target_company_id
    and m.user_id is null
    and m.status = 'invited'
    and lower(m.invited_email) = normalized_email
    and m.created_at <= now() - interval '14 days';

  insert into public.company_members (company_id, status, invited_by, invited_email, invite_token)
  values (target_company_id, 'invited', (select auth.uid()), normalized_email, gen_random_uuid())
  returning invite_token, company_members.id into token, new_invitation_id;

  insert into public.audit_log (company_id, actor_user_id, action, entity, entity_id, after)
  values (target_company_id, (select auth.uid()), 'member.invite', 'company_members', new_invitation_id,
          jsonb_build_object('invited_email', normalized_email));

  return token;
end;
$$;

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
  if not (select public.authorize('platform.member.manage', invitation.company_id)) then
    raise exception 'requires platform.member.manage' using errcode = '42501';
  end if;

  delete from public.company_members m where m.id = invitation.id;

  insert into public.audit_log (company_id, actor_user_id, action, entity, entity_id, before)
  values (invitation.company_id, (select auth.uid()), 'member.revoke_invite', 'company_members', invitation.id,
          jsonb_build_object('invited_email', invitation.invited_email));
end;
$$;
