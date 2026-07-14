-- Phase 2 exit / HR seed: the "leave request" toy flow — the first real feature
-- that composes every platform primitive end to end:
--   custom fields (hr_absences) + approvals (four-eyes) + notifications
--   + audit_log + event outbox + security-relevant nothing (it's benign).
-- This seeds modules/hr; the Phase 3 HR module grows it (employees, balances,
-- calendars). Deliberately minimal: one table, one submit door, derive status
-- from the linked approval rather than duplicating it.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Permission catalog (idempotent — the module-migration pattern from
-- permissions_core). hr.absence.* : create/read own..company, approve team..company.
-- ---------------------------------------------------------------------------

insert into public.permissions (key, module, resource, action, allowed_scopes, is_sensitive, description) values
  ('hr.absence.create',  'hr', 'absence', 'create',  '{own,team,company}', false, 'Submit a leave / absence request'),
  ('hr.absence.read',    'hr', 'absence', 'read',    '{own,team,company}', false, 'View leave / absence requests'),
  ('hr.absence.approve', 'hr', 'absence', 'approve', '{team,company}',     false, 'Approve or reject leave / absence requests')
on conflict (key) do update set
  module = excluded.module, resource = excluded.resource, action = excluded.action,
  allowed_scopes = excluded.allowed_scopes, is_sensitive = excluded.is_sensitive,
  description = excluded.description;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.hr_leave_requests (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id),
  member_id       uuid not null references public.company_members (id),  -- the employee (subject)
  subject_user_id uuid not null references public.profiles (id),         -- denormalized for RLS (no cross-table subquery)
  team_id         uuid references public.teams (id),                     -- scope for approval routing
  leave_type   text not null check (leave_type in ('vacation', 'sick', 'personal', 'other')),
  start_date   date not null,
  end_date     date not null,
  reason       text check (reason is null or length(reason) <= 2000),
  custom       jsonb not null default '{}',                           -- custom-field values (entity hr_absences)
  approval_id  uuid references public.approvals (id),                 -- the four-eyes request; status derives from it
  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id),
  deleted_at   timestamptz,
  check (end_date >= start_date)
);

comment on table public.hr_leave_requests is
  'Leave/absence requests (Phase 2 toy flow → Phase 3 HR module). Status derives from the linked approvals row.';

create index hr_leave_requests_company_idx on public.hr_leave_requests (company_id, created_at desc);
create index hr_leave_requests_member_idx on public.hr_leave_requests (member_id);

alter table public.hr_leave_requests enable row level security;

-- Reads: the subject sees their own; anyone with hr.absence.read at the row's
-- scope sees it. Writes go exclusively through submit_leave_request() (the door),
-- so no authenticated insert/update grant — only the definer path and workers.
create policy hr_leave_requests_select
  on public.hr_leave_requests for select to authenticated
  using (
    public.auth_aal2()
    and deleted_at is null
    and (
      subject_user_id = (select auth.uid())  -- the subject always sees their own
      or public.authorize('hr.absence.read', company_id, team_id, subject_user_id)
    )
  );

grant select on table public.hr_leave_requests to authenticated;
grant select, insert, update, delete on table public.hr_leave_requests to service_role;

-- ---------------------------------------------------------------------------
-- submit_leave_request — the one door. Atomic: authorize (own-scope create for
-- self), insert, publish the event (service_role-only otherwise), open the
-- four-eyes approval, audit. Custom values are validated in the server action
-- (buildCustomSchema) before they get here.
-- ---------------------------------------------------------------------------

create or replace function public.submit_leave_request(
  target_company uuid,
  leave_type     text,
  start_date     date,
  end_date       date,
  reason         text  default null,
  custom         jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member   uuid;
  v_team     uuid;
  v_leave    uuid;
  v_approval uuid;
begin
  if not public.auth_aal2() then
    raise exception 'aal2 session required' using errcode = '42501';
  end if;
  if end_date < start_date then
    raise exception 'end date precedes start date' using errcode = '23514';
  end if;

  select cm.id into v_member
  from public.company_members cm
  where cm.company_id = target_company and cm.user_id = (select auth.uid()) and cm.status = 'active';
  if v_member is null then
    raise exception 'not an active member of this company' using errcode = '42501';
  end if;

  -- route the approval to the requester's team (first active membership), so
  -- team-scoped approvers (Supervisor) see it; null falls back to company scope.
  select tm.team_id into v_team
  from public.team_memberships tm
  where tm.member_id = v_member and tm.company_id = target_company
    and now() >= tm.valid_from and (tm.valid_to is null or now() < tm.valid_to)
  order by tm.valid_from
  limit 1;

  -- create for self: own/team/company grants all satisfy this (team resolved above).
  if not public.authorize('hr.absence.create', target_company, v_team, (select auth.uid())) then
    raise exception 'not permitted to request leave here' using errcode = '42501';
  end if;

  insert into public.hr_leave_requests
    (company_id, member_id, subject_user_id, team_id, leave_type, start_date, end_date, reason, custom, created_by)
  values
    (target_company, v_member, (select auth.uid()), v_team, leave_type, start_date, end_date, reason,
     coalesce(custom, '{}'), (select auth.uid()))
  returning id into v_leave;

  perform public.publish_event(
    target_company, 'hr.leave.requested',
    jsonb_build_object('leave_request_id', v_leave, 'member_id', v_member,
                       'type', leave_type, 'start_date', start_date, 'end_date', end_date),
    'user', (select auth.uid()));

  v_approval := public.request_approval(
    target_company, v_team, 'hr.absence.approve', 'hr.absence',
    'hr_leave_requests', v_leave,
    jsonb_build_object('type', leave_type, 'from', start_date::text, 'to', end_date::text));

  update public.hr_leave_requests set approval_id = v_approval where id = v_leave;

  insert into public.audit_log (company_id, actor_user_id, action, entity, entity_id, after)
  values (target_company, (select auth.uid()), 'leave.request', 'hr_leave_requests', v_leave,
          jsonb_build_object('type', leave_type, 'start_date', start_date, 'end_date', end_date));

  return v_leave;
end;
$$;

revoke execute on function public.submit_leave_request(uuid, text, date, date, text, jsonb)
  from anon, public;
grant execute on function public.submit_leave_request(uuid, text, date, date, text, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- The module reacts to its own approvals being decided: publish hr.leave.<status>
-- so downstream (Phase 3 payroll/calendars) can react via the outbox. Scoped to
-- this module's entity only — it never touches other modules' approvals.
-- ---------------------------------------------------------------------------

create or replace function public.on_leave_approval_decided()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.entity = 'hr_leave_requests'
     and old.status = 'pending' and new.status in ('approved', 'rejected') then
    perform public.publish_event(
      new.company_id, 'hr.leave.' || new.status,
      jsonb_build_object('leave_request_id', new.entity_id, 'approval_id', new.id),
      'user', new.decided_by);
  end if;
  return new;
end;
$$;

create trigger approvals_leave_decided
  after update on public.approvals
  for each row execute function public.on_leave_approval_decided();

-- ---------------------------------------------------------------------------
-- Role-template grants (module roleTemplateGrants). Owner/HR Manager at company,
-- Supervisor at team, Employee own (create+read, never approve). Idempotent;
-- backfilled onto existing companies. Future companies get these when the module
-- registry lands (Phase 3) — noted in ROADMAP.
-- ---------------------------------------------------------------------------

create or replace function public.grant_hr_absence_templates(target_company uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.role_permissions (company_role_id, permission_key, scope)
  select r.id, k.key, 'company'
  from public.company_roles r
  cross join (values ('hr.absence.create'), ('hr.absence.read'), ('hr.absence.approve')) as k(key)
  where r.company_id = target_company and r.template_key in ('owner', 'hr_manager')
  on conflict (company_role_id, permission_key) do nothing;

  insert into public.role_permissions (company_role_id, permission_key, scope)
  select r.id, k.key, 'team'
  from public.company_roles r
  cross join (values ('hr.absence.create'), ('hr.absence.read'), ('hr.absence.approve')) as k(key)
  where r.company_id = target_company and r.template_key = 'supervisor'
  on conflict (company_role_id, permission_key) do nothing;

  insert into public.role_permissions (company_role_id, permission_key, scope)
  select r.id, k.key, 'own'
  from public.company_roles r
  cross join (values ('hr.absence.create'), ('hr.absence.read')) as k(key)
  where r.company_id = target_company and r.template_key = 'employee'
  on conflict (company_role_id, permission_key) do nothing;
end;
$$;

revoke execute on function public.grant_hr_absence_templates(uuid) from anon, authenticated, public;

do $$
declare
  c record;
begin
  for c in select id from public.companies where deleted_at is null loop
    perform public.grant_hr_absence_templates(c.id);
  end loop;
end;
$$;
