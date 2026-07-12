-- Phase 2 primitive: notifications (05-data-platform.md; retention 90d).
-- Locale-correct by construction: rows store a `kind` + `params`, rendered in
-- the RECIPIENT's language via i18n catalogs — never pre-rendered text.
-- Created only by security-definer flows (approvals, assignments, …) via
-- notify(); users can read and mark-read their OWN, nothing else. Realtime is
-- enabled so a client subscribes to its own rows (RLS gates the stream).

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id),
  recipient_id uuid not null references public.profiles (id),
  kind         text not null
               check (kind ~ '^[a-z0-9_]+\.[a-z0-9_]+$'),  -- 'approval.requested'
  params       jsonb not null default '{}',                 -- ICU args for the message
  entity       text,
  entity_id    uuid,
  href         text,                                        -- in-app deep link
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

comment on table public.notifications is
  'Per-recipient notifications (05-data-platform.md). kind+params render in the recipient locale. Created via notify() only.';

-- unread-first per recipient, the query the bell runs
create index notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);
create index notifications_recipient_unread_idx
  on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;

-- Read your own, at AAL2 (notifications carry company context).
create policy notifications_select_own
  on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()) and public.auth_aal2());

-- Update your own — only read_at (column grant below); no re-targeting.
create policy notifications_update_own
  on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()) and public.auth_aal2())
  with check (recipient_id = (select auth.uid()));

-- No client insert/delete: notify() creates, the retention sweep deletes.
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;
grant select, insert, update, delete on table public.notifications to service_role;

-- ---------------------------------------------------------------------------
-- notify() — the only creation path (called by definer flows/workers)
-- ---------------------------------------------------------------------------

create or replace function public.notify(
  target_company   uuid,
  target_recipient uuid,
  notif_kind       text,
  notif_params     jsonb default '{}',
  notif_entity     text default null,
  notif_entity_id  uuid default null,
  notif_href       text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  -- only notify an ACTIVE member of the target company
  if not exists (
    select 1 from public.company_members m
    where m.company_id = target_company
      and m.user_id = target_recipient
      and m.status = 'active'
  ) then
    raise exception 'recipient is not an active member of the company'
      using errcode = '23503';
  end if;

  insert into public.notifications
    (company_id, recipient_id, kind, params, entity, entity_id, href)
  values
    (target_company, target_recipient, notif_kind, coalesce(notif_params, '{}'),
     notif_entity, notif_entity_id, notif_href)
  returning id into new_id;

  return new_id;
end;
$$;

-- creation is a system/definer concern — not granted to authenticated
revoke execute on function public.notify(uuid, uuid, text, jsonb, text, uuid, text)
  from anon, authenticated, public;
grant execute on function public.notify(uuid, uuid, text, jsonb, text, uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- mark_notifications_read — one or all of the caller's own
-- ---------------------------------------------------------------------------

create or replace function public.mark_notifications_read(notification_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.notifications n
  set read_at = now()
  where n.recipient_id = (select auth.uid())
    and n.read_at is null
    and (notification_ids is null or n.id = any (notification_ids));
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke execute on function public.mark_notifications_read(uuid[]) from anon, public;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: clients subscribe to their own rows (RLS gates the stream)
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.notifications;
