-- Phase 2 primitive: event outbox (05-data-platform.md). Modules never call
-- each other — they publish events; the outbox guarantees delivery. Publish
-- happens in the SAME transaction as the business write (no lost/phantom
-- events). Async dispatch (pg_cron + Edge worker → subscriber handlers,
-- retry/backoff, dead-letter) is a tracked follow-up; this migration lays the
-- transactional record + publish helper, plus the events-as-integration-audit
-- read surface (Security module / debugging, gated by platform.audit.read).

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.events (
  id           bigint generated always as identity primary key,
  company_id   uuid not null references public.companies (id),
  name         text not null                    -- 'module.entity.verb' or '.vN'
               check (name ~ '^[a-z0-9_]+\.[a-z0-9_]+\.[a-z0-9_]+(\.v[0-9]+)?$'),
  payload      jsonb not null default '{}',      -- zod-validated at publish (app side)
  actor        jsonb not null,                   -- {type:'user'|'ai'|'system', id}
  created_at   timestamptz not null default now(),
  processed_at timestamptz,                       -- set by the dispatcher
  attempts     int not null default 0,
  last_error   text
);

comment on table public.events is
  'Transactional event outbox (05-data-platform.md). Published in the business write''s transaction; consumed by the async dispatcher and read as integration audit.';

-- dispatch queue: unprocessed, oldest first (partial index stays small)
create index events_unprocessed_idx
  on public.events (created_at) where processed_at is null;
create index events_company_created_idx
  on public.events (company_id, created_at desc);

alter table public.events enable row level security;

-- Reads are the integration-audit surface — gated like the audit log.
create policy events_select_authorized
  on public.events for select to authenticated
  using ((select public.authorize('platform.audit.read', company_id)));

-- Inserts only via publish_event() (definer) or workers; the dispatcher
-- (service_role) updates processed_at/attempts. No update/delete for users.
grant select on table public.events to authenticated;
grant select, insert, update, delete on table public.events to service_role;

-- ---------------------------------------------------------------------------
-- publish_event — the only in-app publish path (called by module RPCs in the
-- same transaction as their business write; runs as the definer owner, so it
-- needs no grant to authenticated). Workers publish as service_role.
-- ---------------------------------------------------------------------------

create or replace function public.publish_event(
  target_company uuid,
  event_name     text,
  event_payload  jsonb default '{}',
  actor_type     text default 'user',
  actor_id       uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
  resolved_actor_id uuid := coalesce(actor_id, (select auth.uid()));
begin
  if actor_type not in ('user', 'ai', 'system') then
    raise exception 'invalid actor_type' using errcode = '22000';
  end if;

  insert into public.events (company_id, name, payload, actor)
  values (
    target_company, event_name, coalesce(event_payload, '{}'),
    jsonb_build_object('type', actor_type, 'id', resolved_actor_id)
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- system/definer concern — not granted to authenticated (definer callers run
-- as the owner and may call it; workers use service_role)
revoke execute on function public.publish_event(uuid, text, jsonb, text, uuid)
  from anon, authenticated, public;
grant execute on function public.publish_event(uuid, text, jsonb, text, uuid)
  to service_role;
