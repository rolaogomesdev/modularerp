-- Core tenancy: profiles, companies, company_members + RLS
-- Spec: docs/architecture/02-tenancy-and-identity.md
-- Posture: company data requires AAL2 (mandatory TOTP); an aal1 session reads nothing.

-- Function bodies reference tables created later in this file.
set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Is the current session second-factor verified?
create or replace function public.auth_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
$$;

-- Is the current user an ACTIVE member of the given company?
-- security definer: used inside company_members policies (avoids RLS recursion).
create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = target_company_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
$$;

revoke execute on function public.is_company_member(uuid) from anon;

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users, account-global, owned by the person
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text not null,
  avatar_url         text,
  locale             text not null default 'pt-PT' check (locale in ('pt-PT', 'en')),
  theme              text not null default 'system' check (theme in ('system', 'light', 'dark')),
  notification_prefs jsonb not null default '{}',
  app_role           text not null default 'user' check (app_role in ('user', 'support', 'platform_admin')),
  created_at         timestamptz not null default now()
);

comment on table public.profiles is
  'Account-global personal profile (02-tenancy-and-identity.md). NOT the HR employee record.';

alter table public.profiles enable row level security;

-- Owner reads own row (co-members use the member_directory view, never this table).
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- Owner updates own row. app_role is excluded via column-level grants below —
-- a user must never be able to escalate their own platform role.
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert/delete policies: rows are created by the signup trigger and die
-- with auth.users (cascade). Writes beyond that are service-role only.

-- Grants are explicit (current Supabase default ACLs grant API roles nothing).
-- anon gets NO grant on any tenant table. app_role is deliberately absent from
-- the update column list — a user must never escalate their own platform role.
grant select on table public.profiles to authenticated;
grant update (display_name, avatar_url, locale, theme, notification_prefs)
  on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

-- Create the profile on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    case
      when new.raw_user_meta_data->>'locale' in ('pt-PT', 'en')
        then new.raw_user_meta_data->>'locale'
      else 'pt-PT'
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- companies — a tenant
-- ---------------------------------------------------------------------------

create table public.companies (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique
               check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$'),
  country_code text not null default 'PT' check (country_code ~ '^[A-Z]{2}$'),
  currency     text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  brand        jsonb not null default '{}',
  settings     jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

comment on table public.companies is
  'Tenant. Company data requires an active membership AND an AAL2 session.';

alter table public.companies enable row level security;

-- Active members read their (non-deleted) companies — AAL2 only.
create policy companies_select_member
  on public.companies for select
  to authenticated
  using (
    deleted_at is null
    and public.auth_aal2()
    and public.is_company_member(id)
  );

-- No client insert/update/delete in Phase 0: company creation ships as a
-- security-definer RPC with the tenancy shell; update/delete gate on the
-- Phase 1 permission catalog (platform.company.update).

grant select on table public.companies to authenticated;
grant select, insert, update, delete on table public.companies to service_role;

-- ---------------------------------------------------------------------------
-- company_members — a person's link to a company (NOT the HR employee record)
-- ---------------------------------------------------------------------------

create table public.company_members (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id),
  user_id       uuid references public.profiles (id),
  status        text not null default 'invited' check (status in ('invited', 'active', 'suspended')),
  invited_by    uuid references public.profiles (id),
  invited_email text,
  joined_at     timestamptz,
  created_at    timestamptz not null default now(),
  unique (company_id, user_id),
  -- pre-signup invitations have an email and no user yet; everyone else has a user
  check (user_id is not null or invited_email is not null)
);

comment on table public.company_members is
  'Membership of a user in a company (02-tenancy-and-identity.md). user_id is null only for pre-signup invitations.';

create index company_members_company_id_idx on public.company_members (company_id);
create index company_members_user_id_idx on public.company_members (user_id);

alter table public.company_members enable row level security;

-- Active members see the member list of their companies — AAL2 only.
create policy company_members_select_member
  on public.company_members for select
  to authenticated
  using (
    public.auth_aal2()
    and public.is_company_member(company_id)
  );

-- No client writes in Phase 0: invite/accept ships with the tenancy shell
-- (RPC), manage gates on Phase 1 permissions (platform.member.manage).

grant select on table public.company_members to authenticated;
grant select, insert, update, delete on table public.company_members to service_role;

-- ---------------------------------------------------------------------------
-- member_directory — the ONLY cross-user view of profiles (safe columns)
-- ---------------------------------------------------------------------------

-- Deliberately NOT security_invoker: it must bypass profiles RLS to show
-- co-members, exposing only safe columns. security_barrier prevents leaking
-- rows through side-effecting functions in caller predicates.
create view public.member_directory
with (security_barrier = true)
as
select p.id, p.display_name, p.avatar_url
from public.profiles p
where public.auth_aal2()
  and exists (
    select 1
    from public.company_members mine
    join public.company_members theirs
      on theirs.company_id = mine.company_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.user_id = p.id
      and theirs.status = 'active'
  );

comment on view public.member_directory is
  'Safe profile columns of co-members (display name, avatar). Never prefs or security fields.';

revoke all on public.member_directory from anon;
grant select on public.member_directory to authenticated;
