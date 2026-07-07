-- Phase 1: permissions core — catalog, teams, roles, memberships, authorize()
-- Spec: docs/architecture/03-permissions.md (the contract; sketch refined here)
-- Enforcement lives in Postgres: every future tenant table's RLS calls authorize().

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- permissions — global catalog, seeded by modules; companies cannot invent keys
-- ---------------------------------------------------------------------------

create table public.permissions (
  key            text primary key
                 check (key ~ '^[a-z0-9_]+\.[a-z0-9_]+\.[a-z0-9_]+$'),
  module         text not null,
  resource       text not null,
  action         text not null,
  allowed_scopes text[] not null default '{own,team,company}'
                 check (allowed_scopes <@ array['own','team','company']
                        and array_length(allowed_scopes, 1) >= 1),
  is_sensitive   boolean not null default false,
  description    text not null
);

comment on table public.permissions is
  'Global permission catalog (03-permissions.md). Seeded idempotently by module migrations.';

alter table public.permissions enable row level security;

-- The catalog is not tenant data: any signed-in user may read it (the roles
-- matrix UI needs it); writes are migration/seed-time only.
create policy permissions_select_authenticated
  on public.permissions for select
  to authenticated
  using (true);

grant select on table public.permissions to authenticated;
grant select on table public.permissions to service_role;

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------

create table public.teams (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id),
  name           text not null check (length(trim(name)) between 1 and 80),
  parent_team_id uuid references public.teams (id),
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (company_id, name)
);

comment on table public.teams is
  'Teams within a company. parent_team_id records the org chart; v1 scope resolution is flat (03-permissions.md).';

create index teams_company_id_idx on public.teams (company_id);

-- ---------------------------------------------------------------------------
-- company_roles + role_permissions
-- ---------------------------------------------------------------------------

create table public.company_roles (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id),
  name         text not null check (length(trim(name)) between 1 and 80),
  description  text,
  template_key text,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (company_id, name)
);

create index company_roles_company_id_idx on public.company_roles (company_id);

create table public.role_permissions (
  company_role_id uuid not null references public.company_roles (id) on delete cascade,
  permission_key  text not null references public.permissions (key),
  scope           text not null check (scope in ('own', 'team', 'company')),
  primary key (company_role_id, permission_key)
);

create index role_permissions_permission_key_idx
  on public.role_permissions (permission_key);

-- The chosen scope must be one the catalog allows for that permission.
create or replace function public.validate_role_permission_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.permissions p
    where p.key = new.permission_key
      and new.scope = any (p.allowed_scopes)
  ) then
    raise exception 'scope "%" is not allowed for permission "%"', new.scope, new.permission_key
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger role_permissions_scope_check
  before insert or update on public.role_permissions
  for each row execute function public.validate_role_permission_scope();

-- ---------------------------------------------------------------------------
-- team_memberships — user × team × role; time-boundable (delegation)
-- ---------------------------------------------------------------------------

create table public.team_memberships (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id), -- denormalized for RLS speed
  team_id         uuid not null references public.teams (id),
  member_id       uuid not null references public.company_members (id),
  company_role_id uuid not null references public.company_roles (id),
  valid_from      timestamptz not null default now(),
  valid_to        timestamptz check (valid_to is null or valid_to > valid_from),
  delegated_from  uuid references public.company_members (id),
  created_by      uuid not null references public.profiles (id),
  created_at      timestamptz not null default now(),
  unique (team_id, member_id, company_role_id)
);

comment on table public.team_memberships is
  'A user holds a role within a team (03-permissions.md). Delegation = time-bound row with delegated_from.';

create index team_memberships_company_member_idx
  on public.team_memberships (company_id, member_id);

-- Cross-company referential integrity: team, member and role must all belong
-- to the membership's company.
create or replace function public.validate_team_membership_company()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.teams t
                 where t.id = new.team_id and t.company_id = new.company_id) then
    raise exception 'team does not belong to company' using errcode = '23514';
  end if;
  if not exists (select 1 from public.company_members m
                 where m.id = new.member_id and m.company_id = new.company_id) then
    raise exception 'member does not belong to company' using errcode = '23514';
  end if;
  if not exists (select 1 from public.company_roles r
                 where r.id = new.company_role_id and r.company_id = new.company_id) then
    raise exception 'role does not belong to company' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger team_memberships_company_check
  before insert or update on public.team_memberships
  for each row execute function public.validate_team_membership_company();

-- ---------------------------------------------------------------------------
-- authorize() — THE resolver (03-permissions.md, verbatim semantics)
-- ---------------------------------------------------------------------------

create or replace function public.authorize(
  p_permission text,
  p_company    uuid,
  p_team       uuid default null,  -- team the TARGET ROW belongs to
  p_owner      uuid default null   -- user the TARGET ROW is about
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    -- 2FA is not optional: only AAL2 sessions resolve any permission
    coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
    and exists (
      select 1
      from public.team_memberships tm
      join public.company_members cm on cm.id = tm.member_id
      join public.role_permissions rp on rp.company_role_id = tm.company_role_id
      where cm.user_id = (select auth.uid())
        and cm.status  = 'active'
        and tm.company_id = p_company
        and rp.permission_key = p_permission
        and now() >= tm.valid_from
        and (tm.valid_to is null or now() < tm.valid_to)
        and (
             rp.scope = 'company'
          or (rp.scope = 'team' and p_team  is not null and tm.team_id = p_team)
          or (rp.scope = 'own'  and p_owner is not null and p_owner = (select auth.uid()))
        )
    );
$$;

comment on function public.authorize is
  'Single permission resolver used by all RLS policies and app pre-checks. Call as (select authorize(...)) inside policies.';

revoke execute on function public.authorize(text, uuid, uuid, uuid) from anon, public;
grant execute on function public.authorize(text, uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS for the permission tables themselves
-- Reads: any active company member (the org structure is not a secret inside
-- the company). Writes: authorize()-gated. NOTE: until the Phase 1 escalation
-- guards land (RPC layer: "cannot grant what you don't hold", last-Owner
-- protection), only Owner-template holders should hold platform.role.manage.
-- ---------------------------------------------------------------------------

alter table public.teams enable row level security;
alter table public.company_roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.team_memberships enable row level security;

create policy teams_select_member
  on public.teams for select to authenticated
  using (public.auth_aal2() and public.is_company_member(company_id));
create policy teams_insert_manage
  on public.teams for insert to authenticated
  with check ((select public.authorize('platform.team.manage', company_id)));
create policy teams_update_manage
  on public.teams for update to authenticated
  using ((select public.authorize('platform.team.manage', company_id)))
  with check ((select public.authorize('platform.team.manage', company_id)));

create policy company_roles_select_member
  on public.company_roles for select to authenticated
  using (public.auth_aal2() and public.is_company_member(company_id));
create policy company_roles_insert_manage
  on public.company_roles for insert to authenticated
  with check ((select public.authorize('platform.role.manage', company_id)));
create policy company_roles_update_manage
  on public.company_roles for update to authenticated
  using ((select public.authorize('platform.role.manage', company_id)))
  with check ((select public.authorize('platform.role.manage', company_id)));

create policy role_permissions_select_member
  on public.role_permissions for select to authenticated
  using (exists (
    select 1 from public.company_roles r
    where r.id = company_role_id
      and public.auth_aal2() and public.is_company_member(r.company_id)
  ));
create policy role_permissions_write_manage
  on public.role_permissions for insert to authenticated
  with check (exists (
    select 1 from public.company_roles r
    where r.id = company_role_id
      and (select public.authorize('platform.role.manage', r.company_id))
  ));
create policy role_permissions_delete_manage
  on public.role_permissions for delete to authenticated
  using (exists (
    select 1 from public.company_roles r
    where r.id = company_role_id
      and (select public.authorize('platform.role.manage', r.company_id))
  ));

create policy team_memberships_select_member
  on public.team_memberships for select to authenticated
  using (public.auth_aal2() and public.is_company_member(company_id));
create policy team_memberships_insert_manage
  on public.team_memberships for insert to authenticated
  with check ((select public.authorize('platform.member.manage', company_id)));
create policy team_memberships_update_manage
  on public.team_memberships for update to authenticated
  using ((select public.authorize('platform.member.manage', company_id)))
  with check ((select public.authorize('platform.member.manage', company_id)));
create policy team_memberships_delete_manage
  on public.team_memberships for delete to authenticated
  using ((select public.authorize('platform.member.manage', company_id)));

grant select on table public.teams, public.company_roles,
  public.role_permissions, public.team_memberships to authenticated;
grant insert, update on table public.teams, public.company_roles to authenticated;
grant insert, delete on table public.role_permissions to authenticated;
grant insert, update, delete on table public.team_memberships to authenticated;
grant select, insert, update, delete on table public.teams, public.company_roles,
  public.role_permissions, public.team_memberships, public.permissions to service_role;

-- ---------------------------------------------------------------------------
-- authorize() in action: companies.update now requires platform.company.update
-- (posture promised in 02-tenancy-and-identity.md)
-- ---------------------------------------------------------------------------

create policy companies_update_authorized
  on public.companies for update to authenticated
  using ((select public.authorize('platform.company.update', id)))
  with check ((select public.authorize('platform.company.update', id)));

-- slug stays immutable through the API; deleted_at is platform-admin territory
grant update (name, brand, settings, country_code, currency)
  on table public.companies to authenticated;

-- ---------------------------------------------------------------------------
-- Platform permission catalog seed (idempotent — the pattern module
-- migrations will reuse)
-- ---------------------------------------------------------------------------

insert into public.permissions (key, module, resource, action, allowed_scopes, is_sensitive, description) values
  ('platform.company.update', 'platform', 'company', 'update', '{company}', false, 'Edit company profile (name, branding, settings)'),
  ('platform.member.manage',  'platform', 'member',  'manage', '{company}', false, 'Invite, suspend and assign members to teams and roles'),
  ('platform.role.manage',    'platform', 'role',    'manage', '{company}', true,  'Create and edit roles and their permission grants'),
  ('platform.team.manage',    'platform', 'team',    'manage', '{company}', false, 'Create and edit teams'),
  ('platform.module.manage',  'platform', 'module',  'manage', '{company}', false, 'Enable or disable modules for the company'),
  ('platform.audit.read',     'platform', 'audit',   'read',   '{company}', true,  'Read the company audit log')
on conflict (key) do update set
  module = excluded.module,
  resource = excluded.resource,
  action = excluded.action,
  allowed_scopes = excluded.allowed_scopes,
  is_sensitive = excluded.is_sensitive,
  description = excluded.description;
