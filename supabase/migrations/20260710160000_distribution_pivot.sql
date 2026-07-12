-- ADR-0004: sales-led, invitation-only distribution.
--  1. create_company requires app_role = 'platform_admin'
--  2. admin_create_company(): provision a customer company + owner invitation
--     WITHOUT the admin becoming a member
--  3. accept_invitation grants the invited role template (owner onboarding)
--  4. platform admins read companies METADATA (never member/business rows)
--  5. before-user-created auth hook: signups require a pending invitation

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.app_role = 'platform_admin'
  )
$$;

revoke execute on function public.is_platform_admin() from anon, public;
grant execute on function public.is_platform_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Invitations can carry a role template, granted on accept
-- ---------------------------------------------------------------------------

alter table public.company_members
  add column invited_role_template text
  check (invited_role_template is null
         or invited_role_template in ('owner', 'hr_manager', 'accountant', 'supervisor', 'employee'));

-- ---------------------------------------------------------------------------
-- 1. create_company: platform admins only (ADR-0004; self-serve = one check away)
-- ---------------------------------------------------------------------------

create or replace function public.create_company(company_name text, company_slug text)
returns table (id uuid, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_company_id uuid;
  new_member_id uuid;
begin
  if not public.auth_aal2() or not public.is_platform_admin() then
    raise exception 'company creation is provisioned by the platform (ADR-0004)'
      using errcode = '42501';
  end if;
  if company_name is null or length(trim(company_name)) < 2 then
    raise exception 'invalid company name' using errcode = '22000';
  end if;

  insert into public.companies (name, slug)
  values (trim(company_name), company_slug)
  returning companies.id into new_company_id;

  insert into public.company_members (company_id, user_id, status, joined_at)
  values (new_company_id, (select auth.uid()), 'active', now())
  returning company_members.id into new_member_id;

  perform public.bootstrap_company_owner(new_company_id, new_member_id, (select auth.uid()));

  insert into public.audit_log (company_id, actor_user_id, action, entity, entity_id, after)
  values (new_company_id, (select auth.uid()), 'company.create', 'companies', new_company_id,
          jsonb_build_object('name', trim(company_name), 'slug', company_slug));

  return query select new_company_id, company_slug;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. admin_create_company: provision for a CUSTOMER (admin never joins)
-- ---------------------------------------------------------------------------

create or replace function public.admin_create_company(
  company_name text,
  company_slug text,
  owner_email text
)
returns table (id uuid, slug text, invite_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_company_id uuid;
  new_invitation_id uuid;
  token uuid;
  normalized_email text := lower(trim(owner_email));
begin
  if not public.auth_aal2() or not public.is_platform_admin() then
    raise exception 'requires platform_admin' using errcode = '42501';
  end if;
  if company_name is null or length(trim(company_name)) < 2 then
    raise exception 'invalid company name' using errcode = '22000';
  end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email' using errcode = '22000';
  end if;

  insert into public.companies (name, slug)
  values (trim(company_name), company_slug)
  returning companies.id into new_company_id;

  -- role templates + default team, but NO membership for the admin
  -- (bypass: the provisioning admin holds nothing inside the new company)
  perform set_config('soru.bypass_grant_guard', 'on', true);
  perform public.seed_company_role_templates(new_company_id);
  insert into public.teams (company_id, name)
  values (new_company_id, 'Geral')
  on conflict (company_id, name) do nothing;
  perform set_config('soru.bypass_grant_guard', 'off', true);

  insert into public.company_members
    (company_id, status, invited_by, invited_email, invite_token, invited_role_template)
  values
    (new_company_id, 'invited', (select auth.uid()), normalized_email, gen_random_uuid(), 'owner')
  returning company_members.id, company_members.invite_token
    into new_invitation_id, token;

  insert into public.audit_log (company_id, actor_user_id, action, entity, entity_id, after)
  values
    (new_company_id, (select auth.uid()), 'company.create', 'companies', new_company_id,
     jsonb_build_object('name', trim(company_name), 'slug', company_slug, 'provisioned', true)),
    (new_company_id, (select auth.uid()), 'member.invite', 'company_members', new_invitation_id,
     jsonb_build_object('invited_email', normalized_email, 'invited_role_template', 'owner'));

  return query select new_company_id, company_slug, token;
end;
$$;

revoke execute on function public.admin_create_company(text, text, text) from anon, public;
grant execute on function public.admin_create_company(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. accept_invitation: grant the invited role template on accept
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

  -- provisioning: the invited role template lands with the acceptance
  if invitation.invited_role_template is not null then
    perform set_config('soru.bypass_grant_guard', 'on', true);
    insert into public.team_memberships (company_id, team_id, member_id, company_role_id, created_by)
    select invitation.company_id, t.id, invitation.id, r.id, (select auth.uid())
    from public.teams t
    join public.company_roles r
      on r.company_id = invitation.company_id
     and r.template_key = invitation.invited_role_template
    where t.company_id = invitation.company_id and t.name = 'Geral'
    on conflict (team_id, member_id, company_role_id) do nothing;
    perform set_config('soru.bypass_grant_guard', 'off', true);
  end if;

  insert into public.audit_log (company_id, actor_user_id, action, entity, entity_id, before, after)
  values (invitation.company_id, (select auth.uid()), 'member.accept', 'company_members', invitation.id,
          jsonb_build_object('status', 'invited'),
          jsonb_build_object('status', 'active',
                             'granted_role_template', invitation.invited_role_template));

  return query
    select c.id, c.slug from public.companies c where c.id = invitation.company_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- SECURITY (review): my_invitations() must NOT hand out tokens for
-- role-bearing (privileged) invitations. Email-match is not email-ownership;
-- an attacker who registers a customer's known email could otherwise pull the
-- owner token and take over the tenant. Privileged invitations are accepted
-- ONLY via the out-of-band link (token possession), never surfaced in-app.
-- ---------------------------------------------------------------------------

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
    and m.invited_role_template is null           -- privileged invites need the link
    and m.created_at > now() - interval '14 days'
    and lower(m.invited_email) = lower(coalesce(auth.jwt()->>'email', ''))
    and public.auth_aal2()
    and c.deleted_at is null
  order by m.created_at desc
$$;

-- ---------------------------------------------------------------------------
-- 4. Platform admins read company METADATA (companies table only)
-- ---------------------------------------------------------------------------

create policy companies_select_platform_admin
  on public.companies for select to authenticated
  using (public.auth_aal2() and public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 5. Signup requires a pending invitation (before-user-created auth hook)
-- ---------------------------------------------------------------------------

create or replace function public.hook_restrict_signup(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- normalize identically to invited_email (lower(trim(...)) everywhere)
  signup_email text := lower(trim(coalesce(event->'user'->>'email', '')));
begin
  if exists (
    select 1 from public.company_members m
    where m.user_id is null
      and m.status = 'invited'
      and lower(m.invited_email) = signup_email
      and m.created_at > now() - interval '14 days'
  ) then
    return event; -- continue
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Signups are by invitation only. Talk to us at sorusoft.pt.'
    )
  );
end;
$$;

-- the auth service is the only caller
revoke execute on function public.hook_restrict_signup(jsonb) from anon, authenticated, public;
grant execute on function public.hook_restrict_signup(jsonb) to supabase_auth_admin;
