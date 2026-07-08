-- Phase 1: escalation guards (03-permissions.md)
--  A. "You cannot grant a permission/scope you don't hold" — enforced on
--     role_permissions writes AND on role assignment (a membership grants
--     the role's whole permission set).
--  B. Last-Owner protection — no operation may leave a company with zero
--     active, currently-valid holders of the Owner-template role; the Owner
--     role itself is shielded (undeletable, grants immutable).
-- Guards apply to authenticated requests only: migrations, seeds and
-- service_role workers (auth.uid() is null) pass through, and internal
-- definer flows (company bootstrap) use a transaction-local bypass flag.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.scope_rank(s text)
returns int
language sql
immutable
as $$
  select case s when 'own' then 1 when 'team' then 2 when 'company' then 3 else 0 end
$$;

-- Does the CALLER hold p_key at p_scope or wider in p_company?
create or replace function public.holds_permission_at_scope(
  p_company uuid,
  p_key text,
  p_scope text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_memberships tm
    join public.company_members cm on cm.id = tm.member_id
    join public.role_permissions rp on rp.company_role_id = tm.company_role_id
    where cm.user_id = (select auth.uid())
      and cm.status = 'active'
      and tm.company_id = p_company
      and rp.permission_key = p_key
      and now() >= tm.valid_from
      and (tm.valid_to is null or now() < tm.valid_to)
      and public.scope_rank(rp.scope) >= public.scope_rank(p_scope)
  )
$$;

revoke execute on function public.holds_permission_at_scope(uuid, text, text) from anon, public;
grant execute on function public.holds_permission_at_scope(uuid, text, text) to authenticated;

create or replace function public.guards_bypassed()
returns boolean
language sql
stable
as $$
  select (select auth.uid()) is null
      or coalesce(nullif(current_setting('soru.bypass_grant_guard', true), ''), 'off') = 'on'
$$;

-- Active users currently holding the Owner-template role in a company,
-- optionally pretending a membership row / member is gone.
create or replace function public.count_active_owner_holders(
  p_company uuid,
  p_exclude_membership uuid default null,
  p_exclude_member uuid default null
) returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct cm.user_id)
  from public.team_memberships tm
  join public.company_roles r
    on r.id = tm.company_role_id and r.template_key = 'owner' and r.deleted_at is null
  join public.company_members cm on cm.id = tm.member_id
  where tm.company_id = p_company
    and cm.status = 'active'
    and now() >= tm.valid_from
    and (tm.valid_to is null or now() < tm.valid_to)
    and (p_exclude_membership is null or tm.id <> p_exclude_membership)
    and (p_exclude_member is null or cm.id <> p_exclude_member)
$$;

-- ---------------------------------------------------------------------------
-- A1. Grant guard: role_permissions writes
-- ---------------------------------------------------------------------------

create or replace function public.guard_role_permission_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
begin
  if public.guards_bypassed() then
    return new;
  end if;
  select company_id into v_company from public.company_roles where id = new.company_role_id;
  if not public.holds_permission_at_scope(v_company, new.permission_key, new.scope) then
    raise exception 'cannot grant "%" at scope "%" — you do not hold it', new.permission_key, new.scope
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger role_permissions_grant_guard
  before insert or update on public.role_permissions
  for each row execute function public.guard_role_permission_grant();

-- ---------------------------------------------------------------------------
-- A2. Assignment guard: giving someone a role = granting its whole set
-- ---------------------------------------------------------------------------

create or replace function public.guard_membership_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.guards_bypassed() then
    return new;
  end if;
  -- date-only changes on an unchanged role grant nothing new
  if tg_op = 'UPDATE' and new.company_role_id = old.company_role_id then
    return new;
  end if;
  if exists (
    select 1 from public.role_permissions rp
    where rp.company_role_id = new.company_role_id
      and not public.holds_permission_at_scope(new.company_id, rp.permission_key, rp.scope)
  ) then
    raise exception 'cannot assign a role whose permissions you do not fully hold'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger team_memberships_assignment_guard
  before insert or update on public.team_memberships
  for each row execute function public.guard_membership_assignment();

-- ---------------------------------------------------------------------------
-- B1. Owner-role shield: grants immutable, role undeletable
-- ---------------------------------------------------------------------------

create or replace function public.guard_owner_role_shield()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.company_roles%rowtype;
begin
  if public.guards_bypassed() then
    return coalesce(new, old);
  end if;
  select * into v_role from public.company_roles where id = old.company_role_id;
  if v_role.template_key = 'owner' then
    raise exception 'the Owner role''s permissions are protected' using errcode = 'PT001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger role_permissions_owner_shield
  before update or delete on public.role_permissions
  for each row execute function public.guard_owner_role_shield();

create or replace function public.guard_owner_role_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.guards_bypassed() then
    return new;
  end if;
  if old.template_key = 'owner'
     and (new.deleted_at is not null or new.template_key is distinct from old.template_key) then
    raise exception 'the Owner role cannot be deleted or retagged' using errcode = 'PT001';
  end if;
  return new;
end;
$$;

create trigger company_roles_owner_shield
  before update on public.company_roles
  for each row execute function public.guard_owner_role_row();

-- ---------------------------------------------------------------------------
-- B2. Last-Owner protection: memberships and suspension
-- ---------------------------------------------------------------------------

create or replace function public.guard_last_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_owner_row boolean;
  v_still_counts boolean;
begin
  if public.guards_bypassed() then
    return coalesce(new, old);
  end if;

  select exists (
    select 1 from public.company_roles r
    where r.id = old.company_role_id and r.template_key = 'owner'
  ) into v_is_owner_row;
  if not v_is_owner_row then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    v_still_counts := false;
  else
    select exists (
      select 1 from public.company_roles r
      where r.id = new.company_role_id and r.template_key = 'owner'
    ) and (new.valid_to is null or new.valid_to > now())
    into v_still_counts;
  end if;

  if not v_still_counts
     and public.count_active_owner_holders(old.company_id, old.id) = 0 then
    raise exception 'a company must keep at least one active Owner' using errcode = 'PT001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger team_memberships_last_owner_guard
  before update or delete on public.team_memberships
  for each row execute function public.guard_last_owner_membership();

create or replace function public.guard_last_owner_suspension()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.guards_bypassed() then
    return new;
  end if;
  if old.status = 'active' and new.status = 'suspended'
     and exists (
       select 1
       from public.team_memberships tm
       join public.company_roles r
         on r.id = tm.company_role_id and r.template_key = 'owner' and r.deleted_at is null
       where tm.member_id = old.id
         and now() >= tm.valid_from
         and (tm.valid_to is null or now() < tm.valid_to)
     )
     and public.count_active_owner_holders(old.company_id, null, old.id) = 0 then
    raise exception 'a company must keep at least one active Owner' using errcode = 'PT001';
  end if;
  return new;
end;
$$;

create trigger company_members_last_owner_guard
  before update on public.company_members
  for each row execute function public.guard_last_owner_suspension();

-- ---------------------------------------------------------------------------
-- Internal flows: bootstrap assigns Owner to a fresh creator who holds
-- nothing yet — bypass the guards for exactly that transaction.
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
  perform set_config('soru.bypass_grant_guard', 'on', true);

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

  perform set_config('soru.bypass_grant_guard', 'off', true);
end;
$$;
