-- Phase 1 close: permission changes are ALWAYS audited (03-permissions.md) —
-- enforced at the database, so even a raw API write to role_permissions or
-- team_memberships leaves a trail. actor is the calling user; internal flows
-- (bootstrap, migrations) land as actor_type 'system' with no user.

set check_function_bodies = off;

create or replace function public.audit_permission_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_entity_id uuid;
  v_action text;
  v_actor uuid := (select auth.uid());
begin
  -- NOTE: field refs must live in separately-executed statements — plpgsql
  -- resolves every column in an expression even in untaken CASE branches,
  -- and role_permissions has no `id` column.
  if tg_table_name = 'role_permissions' then
    select r.company_id into v_company
    from public.company_roles r
    where r.id = coalesce(new.company_role_id, old.company_role_id);
    v_entity_id := null;
    v_action := 'role.grant_' || lower(tg_op);
  else
    v_company := coalesce(new.company_id, old.company_id);
    v_entity_id := coalesce(new.id, old.id);
    v_action := 'membership.' || lower(tg_op);
  end if;

  insert into public.audit_log
    (company_id, actor_user_id, actor_type, action, entity, entity_id, before, after)
  values (
    v_company,
    v_actor,
    case when v_actor is null then 'system' else 'user' end,
    v_action,
    tg_table_name,
    v_entity_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

create trigger role_permissions_audit
  after insert or update or delete on public.role_permissions
  for each row execute function public.audit_permission_change();

create trigger team_memberships_audit
  after insert or update or delete on public.team_memberships
  for each row execute function public.audit_permission_change();
