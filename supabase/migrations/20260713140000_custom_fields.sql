-- Phase 2 primitive: custom fields (05-data-platform.md). "Just one more field"
-- without a migration. DEFINITIONS are company-scoped metadata managed by
-- platform.customfield.manage; VALUES live in each entity's own `custom` jsonb
-- column, so they inherit that entity's RLS automatically (no separate
-- security surface). Modules render defs into forms/detail/export/AI schema.

set check_function_bodies = off;

-- new permission (Owner template gets it for new companies via the seeder;
-- existing Owner roles are backfilled below)
insert into public.permissions (key, module, resource, action, allowed_scopes, is_sensitive, description)
values ('platform.customfield.manage', 'platform', 'customfield', 'manage', '{company}', false,
        'Define and manage custom fields for the company')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.custom_field_defs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id),
  entity      text not null check (entity ~ '^[a-z][a-z0-9_]*$'),  -- 'hr_employees'
  key         text not null check (key ~ '^[a-z][a-z0-9_]*$'),      -- snake_case, immutable
  label       jsonb not null,                                       -- {'pt-PT','en'}
  type        text not null
              check (type in ('text', 'number', 'date', 'select', 'multi_select', 'boolean')),
  config      jsonb not null default '{}',                          -- options, min/max, required
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  archived_at timestamptz,
  unique (company_id, entity, key)
);

comment on table public.custom_field_defs is
  'Company-defined custom fields (05-data-platform.md). Values live in each entity''s custom jsonb.';

create index custom_field_defs_entity_idx
  on public.custom_field_defs (company_id, entity, position);

alter table public.custom_field_defs enable row level security;

-- Every active member can READ defs (forms need them); managing needs the perm.
create policy custom_field_defs_select_member
  on public.custom_field_defs for select to authenticated
  using (public.auth_aal2() and public.is_company_member(company_id));
create policy custom_field_defs_insert_manage
  on public.custom_field_defs for insert to authenticated
  with check ((select public.authorize('platform.customfield.manage', company_id)));
create policy custom_field_defs_update_manage
  on public.custom_field_defs for update to authenticated
  using ((select public.authorize('platform.customfield.manage', company_id)))
  with check ((select public.authorize('platform.customfield.manage', company_id)));
create policy custom_field_defs_delete_manage
  on public.custom_field_defs for delete to authenticated
  using ((select public.authorize('platform.customfield.manage', company_id)));

grant select on table public.custom_field_defs to authenticated;
grant insert, delete on table public.custom_field_defs to authenticated;
-- update is column-limited: identity (entity/key/type) is immutable post-create
grant update (label, config, position, archived_at)
  on table public.custom_field_defs to authenticated;
grant select, insert, update, delete on table public.custom_field_defs to service_role;

-- Belt and braces: even service_role edits must not rewrite a field's identity
create or replace function public.guard_custom_field_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.entity <> old.entity or new.key <> old.key or new.type <> old.type then
    raise exception 'a custom field''s entity, key and type are immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger custom_field_defs_immutable
  before update on public.custom_field_defs
  for each row execute function public.guard_custom_field_immutable();

-- ---------------------------------------------------------------------------
-- Backfill: existing Owner roles gain the new permission (guards bypass in
-- migration context — auth.uid() is null)
-- ---------------------------------------------------------------------------

insert into public.role_permissions (company_role_id, permission_key, scope)
select r.id, 'platform.customfield.manage', 'company'
from public.company_roles r
where r.template_key = 'owner' and r.deleted_at is null
on conflict (company_role_id, permission_key) do nothing;
