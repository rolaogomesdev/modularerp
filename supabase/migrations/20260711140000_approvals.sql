-- Phase 2 primitive: approvals / four-eyes (03-permissions.md, 05-data-platform.md).
-- A request needs an approver who holds the row's *.approve permission at the
-- row's scope (authorize() reused). Self-approval is refused by construction
-- (requester ≠ decider) — segregation of duties. Requests notify eligible
-- approvers; decisions notify the requester; both audited.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.approvals (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id),
  team_id         uuid references public.teams (id),         -- scope of the subject
  requester_id    uuid not null references public.profiles (id),
  permission_key  text not null references public.permissions (key), -- approver needs this
  kind            text not null,                              -- render label, e.g. 'hr.absence'
  entity          text,
  entity_id       uuid,
  summary         jsonb not null default '{}',                -- params for locale-side rendering
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by      uuid references public.profiles (id),
  decided_at      timestamptz,
  decision_reason text,
  created_at      timestamptz not null default now(),
  -- a decision must record who + when
  check ((status in ('pending', 'cancelled')) = (decided_by is null))
);

comment on table public.approvals is
  'Four-eyes approval requests (03-permissions.md). Approver visibility via authorize(permission_key); self-approval refused.';

create index approvals_company_status_idx on public.approvals (company_id, status);
create index approvals_requester_idx on public.approvals (requester_id, created_at desc);
create index approvals_scope_idx on public.approvals (company_id, team_id);

alter table public.approvals enable row level security;

-- Requester sees their own; approvers see what they can decide (authorize()
-- with the row's own permission_key + scope). AAL2 always.
create policy approvals_select
  on public.approvals for select to authenticated
  using (
    public.auth_aal2()
    and (
      requester_id = (select auth.uid())
      or public.authorize(permission_key, company_id, team_id, requester_id)
    )
  );

-- No direct writes: request_approval() / decide_approval() / cancel are the doors.
grant select on table public.approvals to authenticated;
grant select, insert, update, delete on table public.approvals to service_role;

-- ---------------------------------------------------------------------------
-- request_approval — create a pending request + notify eligible approvers
-- The calling module checks its own *.create permission; the primitive only
-- requires active membership.
-- ---------------------------------------------------------------------------

create or replace function public.request_approval(
  target_company    uuid,
  target_team       uuid,
  approve_permission text,
  approval_kind     text,
  target_entity     text default null,
  target_entity_id  uuid default null,
  approval_summary  jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  approver record;
begin
  if not public.auth_aal2() or not public.is_company_member(target_company) then
    raise exception 'not an active member of this company' using errcode = '42501';
  end if;
  -- cross-company integrity: the subject team must belong to the company
  if target_team is not null and not exists (
    select 1 from public.teams t where t.id = target_team and t.company_id = target_company
  ) then
    raise exception 'team does not belong to company' using errcode = '23514';
  end if;

  insert into public.approvals
    (company_id, team_id, requester_id, permission_key, kind, entity, entity_id, summary)
  values
    (target_company, target_team, (select auth.uid()), approve_permission,
     approval_kind, target_entity, target_entity_id, coalesce(approval_summary, '{}'))
  returning id into new_id;

  -- notify every active holder of the approve permission in scope (not the requester)
  for approver in
    select distinct cm.user_id
    from public.team_memberships tm
    join public.company_members cm on cm.id = tm.member_id and cm.status = 'active'
    join public.role_permissions rp on rp.company_role_id = tm.company_role_id
    where tm.company_id = target_company
      and rp.permission_key = approve_permission
      and now() >= tm.valid_from
      and (tm.valid_to is null or now() < tm.valid_to)
      and (rp.scope = 'company' or (rp.scope = 'team' and tm.team_id = target_team))
      and cm.user_id <> (select auth.uid())
  loop
    perform public.notify(
      target_company, approver.user_id, 'approval.requested',
      approval_summary, 'approvals', new_id, '/c/' ||
        (select slug from public.companies where id = target_company) || '/approvals');
  end loop;

  insert into public.audit_log (company_id, actor_user_id, action, entity, entity_id, after)
  values (target_company, (select auth.uid()), 'approval.request', 'approvals', new_id,
          jsonb_build_object('permission_key', approve_permission, 'kind', approval_kind));

  return new_id;
end;
$$;

revoke execute on function public.request_approval(uuid, uuid, text, text, text, uuid, jsonb)
  from anon, public;
grant execute on function public.request_approval(uuid, uuid, text, text, text, uuid, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- decide_approval — approve/reject (four-eyes enforced) + notify + audit
-- ---------------------------------------------------------------------------

create or replace function public.decide_approval(
  approval_id uuid,
  approve     boolean,
  reason      text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.approvals%rowtype;
  new_status text := case when approve then 'approved' else 'rejected' end;
begin
  select * into a from public.approvals where id = approval_id;
  if not found or a.status <> 'pending' then
    raise exception 'approval not found or already decided' using errcode = 'P0002';
  end if;

  -- four-eyes: the requester can never decide their own request
  if a.requester_id = (select auth.uid()) then
    raise exception 'you cannot decide your own request' using errcode = 'PT002';
  end if;

  -- the decider must hold the approve permission at the row's scope
  if not public.authorize(a.permission_key, a.company_id, a.team_id, a.requester_id) then
    raise exception 'you do not hold the approval permission' using errcode = '42501';
  end if;

  update public.approvals
  set status = new_status,
      decided_by = (select auth.uid()),
      decided_at = now(),
      decision_reason = reason
  where id = approval_id;

  -- best-effort: notifying the requester must never roll back a valid decision
  -- (e.g. the requester may have been suspended since requesting)
  begin
    perform public.notify(
      a.company_id, a.requester_id, 'approval.decided',
      a.summary || jsonb_build_object('decision', new_status),
      'approvals', approval_id, '/c/' ||
        (select slug from public.companies where id = a.company_id) || '/approvals');
  exception when others then
    null;
  end;

  insert into public.audit_log
    (company_id, actor_user_id, action, entity, entity_id, before, after, reason)
  values (a.company_id, (select auth.uid()), 'approval.decide', 'approvals', approval_id,
          jsonb_build_object('status', 'pending'),
          jsonb_build_object('status', new_status), reason);
end;
$$;

revoke execute on function public.decide_approval(uuid, boolean, text) from anon, public;
grant execute on function public.decide_approval(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_approval — the requester withdraws their own pending request
-- ---------------------------------------------------------------------------

create or replace function public.cancel_approval(approval_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.approvals%rowtype;
begin
  select * into a from public.approvals where id = approval_id;
  if not found or a.status <> 'pending' then
    raise exception 'approval not found or already decided' using errcode = 'P0002';
  end if;
  if a.requester_id <> (select auth.uid()) then
    raise exception 'only the requester can cancel' using errcode = '42501';
  end if;

  update public.approvals set status = 'cancelled' where id = approval_id;

  insert into public.audit_log (company_id, actor_user_id, action, entity, entity_id, after)
  values (a.company_id, (select auth.uid()), 'approval.cancel', 'approvals', approval_id,
          jsonb_build_object('status', 'cancelled'));
end;
$$;

revoke execute on function public.cancel_approval(uuid) from anon, public;
grant execute on function public.cancel_approval(uuid) to authenticated;
