-- Phase 1: audit_log primitive (03-permissions.md) + write-path helper.
-- Append-only by construction: no UPDATE/DELETE grants exist for anyone;
-- authenticated users cannot INSERT directly — entries are written by
-- security-definer paths that stamp the real actor, or by service_role
-- workers (actor_type 'ai'|'system'). Reads require platform.audit.read
-- (sensitive). Every existing mutation RPC now writes an entry.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id),
  actor_user_id uuid references public.profiles (id),
  actor_type    text not null default 'user' check (actor_type in ('user', 'ai', 'system')),
  action        text not null check (action ~ '^[a-z0-9_]+\.[a-z0-9_]+$'),
  entity        text not null,
  entity_id     uuid,
  before        jsonb,
  after         jsonb,
  reason        text,
  created_at    timestamptz not null default now()
);

comment on table public.audit_log is
  'Append-only audit trail (03-permissions.md). Written via definer paths/workers only; never updated or deleted.';

create index audit_log_company_created_idx
  on public.audit_log (company_id, created_at desc);

alter table public.audit_log enable row level security;

create policy audit_log_select_authorized
  on public.audit_log for select to authenticated
  using ((select public.authorize('platform.audit.read', company_id)));

-- Reads for permission holders; inserts ONLY via definer functions (below)
-- and service_role workers. No update/delete grants — for anyone.
grant select on table public.audit_log to authenticated;
grant select, insert on table public.audit_log to service_role;

-- ---------------------------------------------------------------------------
-- Write-path helper for server actions: stamps the real actor, refuses
-- cross-company writes. Callers cannot impersonate anyone — there is no
-- actor parameter.
-- ---------------------------------------------------------------------------

create or replace function public.log_audit(
  target_company_id uuid,
  audit_action      text,
  audit_entity      text,
  audit_entity_id   uuid default null,
  entry_before      jsonb default null,
  entry_after       jsonb default null,
  entry_reason      text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.auth_aal2() or not public.is_company_member(target_company_id) then
    raise exception 'not an active member of this company' using errcode = '42501';
  end if;

  insert into public.audit_log
    (company_id, actor_user_id, actor_type, action, entity, entity_id, before, after, reason)
  values
    (target_company_id, (select auth.uid()), 'user', audit_action, audit_entity,
     audit_entity_id, entry_before, entry_after, entry_reason);
end;
$$;

revoke execute on function public.log_audit(uuid, text, text, uuid, jsonb, jsonb, text) from anon, public;
grant execute on function public.log_audit(uuid, text, text, uuid, jsonb, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Existing mutation RPCs now write audit entries (definer context inserts
-- directly; actor is always the calling user)
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

  insert into public.audit_log (company_id, actor_user_id, action, entity, entity_id, after)
  values (new_company_id, (select auth.uid()), 'company.create', 'companies', new_company_id,
          jsonb_build_object('name', trim(company_name), 'slug', company_slug));

  return query select new_company_id, company_slug;
end;
$$;

create or replace function public.invite_member(target_company_id uuid, invitee_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  token uuid;
  new_invitation_id uuid;
  normalized_email text := lower(trim(invitee_email));
begin
  if not public.auth_aal2() or not public.is_company_member(target_company_id) then
    raise exception 'not an active member of this company' using errcode = '42501';
  end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email' using errcode = '22000';
  end if;
  if exists (
    select 1
    from public.company_members m
    join auth.users u on u.id = m.user_id
    where m.company_id = target_company_id
      and lower(u.email) = normalized_email
  ) then
    raise exception 'already a member' using errcode = '23505';
  end if;

  delete from public.company_members m
  where m.company_id = target_company_id
    and m.user_id is null
    and m.status = 'invited'
    and lower(m.invited_email) = normalized_email
    and m.created_at <= now() - interval '14 days';

  insert into public.company_members (company_id, status, invited_by, invited_email, invite_token)
  values (target_company_id, 'invited', (select auth.uid()), normalized_email, gen_random_uuid())
  returning invite_token, company_members.id into token, new_invitation_id;

  insert into public.audit_log (company_id, actor_user_id, action, entity, entity_id, after)
  values (target_company_id, (select auth.uid()), 'member.invite', 'company_members', new_invitation_id,
          jsonb_build_object('invited_email', normalized_email));

  return token;
end;
$$;

create or replace function public.accept_invitation(token uuid)
returns table (company_id uuid, company_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.company_members%rowtype;
  caller_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if (select auth.uid()) is null or not public.auth_aal2() then
    raise exception 'aal2 session required' using errcode = '42501';
  end if;

  select * into invitation
  from public.company_members m
  where m.invite_token = token
    and m.user_id is null
    and m.status = 'invited'
    and m.created_at > now() - interval '14 days'
    and exists (
      select 1 from public.companies c
      where c.id = m.company_id and c.deleted_at is null
    );

  if not found then
    raise exception 'invitation not found, expired or already used' using errcode = 'P0002';
  end if;
  if lower(invitation.invited_email) <> caller_email then
    raise exception 'invitation was sent to a different email' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.company_members m
    where m.company_id = invitation.company_id and m.user_id = (select auth.uid())
  ) then
    raise exception 'already a member' using errcode = '23505';
  end if;

  update public.company_members m
  set user_id = (select auth.uid()),
      status = 'active',
      joined_at = now(),
      invite_token = null
  where m.id = invitation.id;

  insert into public.audit_log (company_id, actor_user_id, action, entity, entity_id, before, after)
  values (invitation.company_id, (select auth.uid()), 'member.accept', 'company_members', invitation.id,
          jsonb_build_object('status', 'invited'),
          jsonb_build_object('status', 'active'));

  return query
    select c.id, c.slug from public.companies c where c.id = invitation.company_id;
end;
$$;

create or replace function public.revoke_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.company_members%rowtype;
begin
  select * into invitation
  from public.company_members m
  where m.id = invitation_id and m.user_id is null and m.status = 'invited';

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  if not public.auth_aal2() or not public.is_company_member(invitation.company_id) then
    raise exception 'not an active member of this company' using errcode = '42501';
  end if;

  delete from public.company_members m where m.id = invitation.id;

  insert into public.audit_log (company_id, actor_user_id, action, entity, entity_id, before)
  values (invitation.company_id, (select auth.uid()), 'member.revoke_invite', 'company_members', invitation.id,
          jsonb_build_object('invited_email', invitation.invited_email));
end;
$$;
