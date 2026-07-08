-- Phase 1: role templates seeded at company creation (03-permissions.md)
-- Owner / HR Manager / Accountant / Supervisor / Employee per company.
-- Owner receives every company-scopable permission in today's catalog;
-- the other templates are created named-but-lean — module migrations append
-- their grants when their permission keys arrive (04-module-system.md,
-- roleTemplateGrants). Existing companies are backfilled: first active
-- member becomes Owner.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Template seeder (internal — reached only via create_company / backfill)
-- ---------------------------------------------------------------------------

create or replace function public.seed_company_role_templates(target_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.company_roles (company_id, name, description, template_key) values
    (target_company_id, 'Owner',      'Full control of the company',                                    'owner'),
    (target_company_id, 'HR Manager', 'Human resources — grants arrive with the HR module',            'hr_manager'),
    (target_company_id, 'Accountant', 'Finance — grants arrive with the Finance module',               'accountant'),
    (target_company_id, 'Supervisor', 'Team supervision — grants arrive with HR/Production modules',   'supervisor'),
    (target_company_id, 'Employee',   'Own-scope basics — grants arrive with the business modules',    'employee')
  on conflict (company_id, name) do nothing;

  -- Owner: every company-scopable permission currently in the catalog
  insert into public.role_permissions (company_role_id, permission_key, scope)
  select r.id, p.key, 'company'
  from public.company_roles r
  cross join public.permissions p
  where r.company_id = target_company_id
    and r.template_key = 'owner'
    and 'company' = any (p.allowed_scopes)
  on conflict (company_role_id, permission_key) do nothing;
end;
$$;

revoke execute on function public.seed_company_role_templates(uuid) from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Bootstrap: templates + default team + Owner assignment (idempotent)
-- ---------------------------------------------------------------------------

create or replace function public.bootstrap_company_owner(
  target_company_id uuid,
  owner_member_id uuid,
  owner_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_company_role_templates(target_company_id);

  insert into public.teams (company_id, name)
  values (target_company_id, 'Geral')
  on conflict (company_id, name) do nothing;

  insert into public.team_memberships (company_id, team_id, member_id, company_role_id, created_by)
  select target_company_id, t.id, owner_member_id, r.id, owner_user_id
  from public.teams t
  join public.company_roles r
    on r.company_id = target_company_id and r.template_key = 'owner'
  where t.company_id = target_company_id and t.name = 'Geral'
  on conflict (team_id, member_id, company_role_id) do nothing;
end;
$$;

revoke execute on function public.bootstrap_company_owner(uuid, uuid, uuid) from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- create_company v2: creator becomes Owner of the 'Geral' team
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
  if (select auth.uid()) is null or not public.auth_aal2() then
    raise exception 'aal2 session required' using errcode = '42501';
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

  return query select new_company_id, company_slug;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: companies created before templates existed
-- (first active member becomes Owner — on staging that makes the founder
-- of each real company its Owner)
-- ---------------------------------------------------------------------------

do $$
declare
  c record;
  m record;
begin
  for c in
    select co.id from public.companies co
    where co.deleted_at is null
      and not exists (select 1 from public.company_roles r where r.company_id = co.id)
  loop
    select cm.id, cm.user_id into m
    from public.company_members cm
    where cm.company_id = c.id and cm.status = 'active' and cm.user_id is not null
    order by cm.created_at asc
    limit 1;

    if m.id is not null then
      perform public.bootstrap_company_owner(c.id, m.id, m.user_id);
    else
      perform public.seed_company_role_templates(c.id);
    end if;
  end loop;
end;
$$;
