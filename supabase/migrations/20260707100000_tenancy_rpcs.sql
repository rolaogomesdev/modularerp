-- Tenancy shell RPCs: create_company, invite_member, accept_invitation
-- Spec: docs/architecture/02-tenancy-and-identity.md (Flows)
-- Phase 0 authorization stubs: "active member" gates invites; the Phase 1
-- permission catalog (platform.member.manage etc.) will tighten these.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Invitation token on company_members (pre-signup invitations carry it)
-- ---------------------------------------------------------------------------

alter table public.company_members
  add column invite_token uuid unique default null;

-- One pending invitation per email per company.
create unique index company_members_pending_invite_uidx
  on public.company_members (company_id, lower(invited_email))
  where user_id is null;

-- The token is a bearer secret: co-members may list memberships but must
-- never read tokens. Column-level privileges enforce it.
revoke select on table public.company_members from authenticated;
grant select (id, company_id, user_id, status, invited_by, invited_email, joined_at, created_at)
  on table public.company_members to authenticated;

-- ---------------------------------------------------------------------------
-- create_company — signup flow: company + creator's active membership
-- ---------------------------------------------------------------------------

create or replace function public.create_company(company_name text, company_slug text)
returns table (id uuid, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_company_id uuid;
begin
  if (select auth.uid()) is null or not public.auth_aal2() then
    raise exception 'aal2 session required' using errcode = '42501';
  end if;
  if company_name is null or length(trim(company_name)) < 2 then
    raise exception 'invalid company name' using errcode = '22000';
  end if;

  insert into public.companies (name, slug)
  values (trim(company_name), company_slug)
  returning companies.id into new_company_id;

  -- Creator becomes an active member. Owner role assignment lands in Phase 1
  -- with the permission catalog.
  insert into public.company_members (company_id, user_id, status, joined_at)
  values (new_company_id, (select auth.uid()), 'active', now());

  return query select new_company_id, company_slug;
end;
$$;

revoke execute on function public.create_company(text, text) from anon, public;
grant execute on function public.create_company(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- invite_member — any ACTIVE member may invite in Phase 0
-- ---------------------------------------------------------------------------

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
  -- Already an active/suspended member with this email?
  if exists (
    select 1
    from public.company_members m
    join auth.users u on u.id = m.user_id
    where m.company_id = target_company_id
      and lower(u.email) = normalized_email
  ) then
    raise exception 'already a member' using errcode = '23505';
  end if;

  insert into public.company_members (company_id, status, invited_by, invited_email, invite_token)
  values (target_company_id, 'invited', (select auth.uid()), normalized_email, gen_random_uuid())
  returning invite_token into token;

  return token;
end;
$$;

revoke execute on function public.invite_member(uuid, text) from anon, public;
grant execute on function public.invite_member(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- accept_invitation — links the invitation to the caller's account
-- ---------------------------------------------------------------------------

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
  where m.invite_token = token and m.user_id is null and m.status = 'invited';

  if not found then
    raise exception 'invitation not found or already used' using errcode = 'P0002';
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

revoke execute on function public.accept_invitation(uuid) from anon, public;
grant execute on function public.accept_invitation(uuid) to authenticated;
