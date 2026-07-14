-- Phase 2: security_events — the detection substrate.
-- A normalized, severity-tagged signal stream that the Phase 8 Security module's
-- detections consume (brute force, mass export, off-hours privilege changes…).
-- Deliberately distinct from audit_log: audit_log is the human/legal "who did
-- what" trail (every mutation, kept for compliance); security_events is the
-- machine-facing "what looks risky" stream, fed by collectors and queried by
-- severity/kind. Append-only; reads are sensitive.
--
-- Collectors land as their call sites appear: privilege changes (DB triggers,
-- here); export volume (data.export — wired from the export route); failed auth
-- and denial spikes (auth.login_failed / access.denied — service_role hooks and
-- workers, using record_security_event). The write path and RLS are complete
-- now so those collectors are one call away.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.security_events (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references public.companies (id),  -- null = platform/global (e.g. pre-company auth)
  actor_user_id uuid references public.profiles (id),   -- null = anonymous / system collector
  kind          text not null check (kind ~ '^[a-z0-9_]+\.[a-z0-9_]+$'),
  severity      text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  source_ip     inet,
  user_agent    text,
  details       jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.security_events is
  'Detection substrate (Phase 8): severity-tagged security signals fed by collectors. Append-only; distinct from audit_log.';

create index security_events_company_created_idx
  on public.security_events (company_id, created_at desc);
create index security_events_kind_created_idx
  on public.security_events (kind, created_at desc);

alter table public.security_events enable row level security;

-- ---------------------------------------------------------------------------
-- Reads (sensitive). Two permissive policies, OR'd:
--   * platform_admin sees everything, including platform-level events
--     (company_id null) that belong to no tenant;
--   * within a company, holders of platform.audit.read see that company's
--     events — the existing "sensitive security data" gate, until the Phase 8
--     Security module ships its own Officer permission.
-- No one ever reads another company's events.
-- ---------------------------------------------------------------------------

create policy security_events_select_platform_admin
  on public.security_events for select to authenticated
  using ((select public.is_platform_admin()));

create policy security_events_select_audit_reader
  on public.security_events for select to authenticated
  using (
    company_id is not null
    and (select public.authorize('platform.audit.read', company_id))
  );

-- Append-only: reads for the gated roles above; inserts ONLY via
-- record_security_event (definer) and service_role collectors. No update or
-- delete grants exist — for anyone — so the stream cannot be rewritten.
grant select on table public.security_events to authenticated;
grant select, insert on table public.security_events to service_role;

-- ---------------------------------------------------------------------------
-- Write path for app collectors (e.g. the export route). Stamps the real actor;
-- an authenticated caller may only file against a company they belong to (or a
-- platform-level event with no company). service_role collectors (auth hooks,
-- workers) run with no auth.uid() and may file for any company or globally.
-- ---------------------------------------------------------------------------

create or replace function public.record_security_event(
  event_kind       text,
  target_company   uuid  default null,
  event_severity   text  default 'info',
  event_details    jsonb default null,
  event_source_ip  inet  default null,
  event_user_agent text  default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  -- Authenticated collectors run in a real (AAL2) session and may only file
  -- against a company they belong to, or a platform-level event (no company).
  -- service_role collectors have no auth.uid() and skip both checks.
  if v_actor is not null then
    if not public.auth_aal2() then
      raise exception 'aal2 session required' using errcode = '42501';
    end if;
    if target_company is not null and not public.is_company_member(target_company) then
      raise exception 'not an active member of this company' using errcode = '42501';
    end if;
  end if;

  insert into public.security_events
    (company_id, actor_user_id, kind, severity, source_ip, user_agent, details)
  values
    (target_company, v_actor, event_kind, event_severity,
     event_source_ip, event_user_agent, event_details);
end;
$$;

revoke execute on function public.record_security_event(text, uuid, text, jsonb, inet, text)
  from anon, public;
grant execute on function public.record_security_event(text, uuid, text, jsonb, inet, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Collector: privilege changes. Fires alongside the audit trigger so even a
-- raw API write to role_permissions or team_memberships surfaces as a signal.
-- (Company resolution mirrors audit_permission_change: role_permissions has no
-- company_id column, so it is resolved through company_roles.)
-- ---------------------------------------------------------------------------

create or replace function public.collect_privilege_security_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
begin
  if tg_table_name = 'role_permissions' then
    select r.company_id into v_company
    from public.company_roles r
    where r.id = coalesce(new.company_role_id, old.company_role_id);
  else
    v_company := coalesce(new.company_id, old.company_id);
  end if;

  insert into public.security_events
    (company_id, actor_user_id, kind, severity, details)
  values (
    v_company,
    (select auth.uid()),
    'privilege.change',
    'warning',
    jsonb_build_object('table', tg_table_name, 'op', lower(tg_op))
  );

  return coalesce(new, old);
end;
$$;

create trigger role_permissions_security_event
  after insert or update or delete on public.role_permissions
  for each row execute function public.collect_privilege_security_event();

create trigger team_memberships_security_event
  after insert or update or delete on public.team_memberships
  for each row execute function public.collect_privilege_security_event();

-- ---------------------------------------------------------------------------
-- Collector: member access revoked/restored. Suspension is instant lockout —
-- a security-relevant privilege change worth its own signal.
-- ---------------------------------------------------------------------------

create or replace function public.collect_member_status_security_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only access revoked/restored (active <-> suspended). The invited -> active
  -- activation on invitation acceptance is normal onboarding, not a signal, and
  -- is already in the audit trail as member.accept.
  if old.status in ('active', 'suspended')
     and new.status in ('active', 'suspended')
     and new.status is distinct from old.status then
    insert into public.security_events
      (company_id, actor_user_id, kind, severity, details)
    values (
      new.company_id,
      (select auth.uid()),
      'privilege.member_status',
      case when new.status = 'suspended' then 'warning' else 'info' end,
      jsonb_build_object('member_id', new.id, 'from', old.status, 'to', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger company_members_status_security_event
  after update of status on public.company_members
  for each row execute function public.collect_member_status_security_event();
