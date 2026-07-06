# 03 — Permissions

The two-layer model: **app roles** govern the platform ([02-tenancy-and-identity.md](02-tenancy-and-identity.md)); inside a company, access = **Company → Teams → Company roles → granular permissions**. Enforcement lives in Postgres RLS through one function, `authorize()`. The app only pre-checks for UX (hide buttons); the database decides.

## Concepts

- **Permission** — smallest grantable capability, key `module.resource.action` (e.g. `hr.absence.approve`, `finance.invoice.create`). Seeded by modules into the catalog; companies cannot invent keys.
- **Scope** — chosen when a permission is granted to a role: `own` (rows about me) | `team` (rows of the team I hold this role in) | `company` (all rows).
- **Company role** — named set of `(permission, scope)` grants, per company (e.g. "HR Manager"). Cloned from shipped templates or built from scratch.
- **Team** — group of people (e.g. "Turno A — Fábrica 1"). Optional `parent_team_id` records the org chart, but **v1 scope resolution is flat** — a grant on a parent does not cascade to child teams (revisit via ADR if real usage demands it).
- **Membership** — `user × team × role`, time-boundable. A user's effective permissions are the **union** of all their memberships.

## Tables (sketch — refined in Phase 1 migrations)

```sql
create table permissions (                      -- global catalog, seeded by modules
  key            text primary key,              -- 'hr.absence.approve'
  module         text not null,                 -- 'hr' | 'finance' | 'platform' | ...
  resource       text not null,
  action         text not null,
  allowed_scopes text[] not null default '{own,team,company}',
  is_sensitive   boolean not null default false, -- extra friction in admin UI (e.g. salaries)
  description    text not null
);

create table teams (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id),
  name           text not null,
  parent_team_id uuid references teams(id),
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create table company_roles (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id),
  name         text not null,
  description  text,
  template_key text,                             -- 'owner' | 'hr_manager' | ... if cloned
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (company_id, name)
);

create table role_permissions (
  company_role_id uuid not null references company_roles(id) on delete cascade,
  permission_key  text not null references permissions(key),
  scope           text not null check (scope in ('own','team','company')),
  primary key (company_role_id, permission_key)
);

create table team_memberships (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id),   -- denormalized for RLS speed
  team_id         uuid not null references teams(id),
  member_id       uuid not null references company_members(id),
  company_role_id uuid not null references company_roles(id),
  valid_from      timestamptz not null default now(),
  valid_to        timestamptz,                                -- delegation = time-bound row
  delegated_from  uuid references company_members(id),        -- who handed this over
  created_by      uuid not null,
  created_at      timestamptz not null default now(),
  unique (team_id, member_id, company_role_id)
);
create index on team_memberships (company_id, member_id);
```

## The resolver: `authorize()`

Single `SECURITY DEFINER` function used by every RLS policy and exposed (read-only) to the app for UX pre-checks:

```sql
create or replace function public.authorize(
  p_permission text,
  p_company    uuid,
  p_team       uuid default null,   -- team the TARGET ROW belongs to
  p_owner      uuid default null    -- user the TARGET ROW is about
) returns boolean
language sql stable security definer set search_path = public as $$
  select
    -- 2FA is not optional: only AAL2 sessions resolve any permission
    coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
    and exists (
      select 1
      from team_memberships tm
      join company_members cm on cm.id = tm.member_id
      join role_permissions rp on rp.company_role_id = tm.company_role_id
      where cm.user_id = (select auth.uid())
        and cm.status  = 'active'
        and tm.company_id = p_company
        and rp.permission_key = p_permission
        and now() >= tm.valid_from
        and (tm.valid_to is null or now() < tm.valid_to)
        and (
             rp.scope = 'company'
          or (rp.scope = 'team' and p_team  is not null and tm.team_id = p_team)
          or (rp.scope = 'own'  and p_owner is not null and p_owner = (select auth.uid()))
        )
    );
$$;
```

Performance notes (Phase 1 acceptance): call it as `(select authorize(...))` inside policies so Postgres caches it per statement, not per row; the `(company_id, member_id)` index keeps it a few index lookups; measure with the RLS test fixtures before optimizing further.

## RLS policy pattern

Every tenant table ships policies in this shape — here the HR absences table (`team_id` = the employee's team, `user_id` = the employee):

```sql
alter table hr_absences enable row level security;

create policy absences_select on hr_absences for select
  using ( (select authorize('hr.absence.read',    company_id, team_id, user_id)) );
create policy absences_insert on hr_absences for insert
  with check ( (select authorize('hr.absence.create', company_id, team_id, user_id)) );
create policy absences_update on hr_absences for update
  using ( (select authorize('hr.absence.update',  company_id, team_id, user_id)) );
-- no delete policy: absences are cancelled (status), not deleted
```

One pattern, everywhere. A table without policies is a bug; CI fails it ([07-security-compliance.md](07-security-compliance.md)).

## Field-level sensitivity = table splitting

Sensitive columns get their own table and their own permission — RLS can then do what "hide this column" cannot:

```sql
create table hr_salaries (          -- 1:1 with hr_employees
  employee_id uuid primary key references hr_employees(id),
  company_id  uuid not null,
  team_id     uuid,
  user_id     uuid not null,        -- the employee (enables scope 'own' payslip access)
  base_salary numeric(12,2) not null,
  ...
);
-- readable only via 'hr.salary.read'; catalog marks it is_sensitive = true
```

Rule: any field the average colleague must not see (salary, IBAN, medical) lives in a split table with its own `*.read` permission.

## Role templates (seeded per company at creation)

| Template | Grants (abridged) |
|---|---|
| **Owner** | every permission, scope `company` (incl. `platform.role.manage`, `platform.member.manage`) |
| **HR Manager** | `hr.*` scope `company`; `hr.salary.*` scope `company` |
| **Accountant** | `finance.*` scope `company` |
| **Supervisor** | `production.*` scope `team`; `hr.absence.approve` scope `team`; `hr.employee.read` scope `team` |
| **Employee** | `hr.absence.create/read` scope `own`; `hr.payslip.read` scope `own`; `finance.expense.create` scope `own` |

Role management is itself permissioned (`platform.role.manage`, `platform.member.manage`) — privilege escalation guards: you cannot grant a permission/scope you don't hold, and the last Owner-role holder cannot be removed.

## Delegation & approvals

- **Delegation** ("my vacation, João covers approvals") = a `team_memberships` row with `valid_from/valid_to` + `delegated_from`, created through an approval, auto-expiring, audited. No special code path — the resolver already honours time bounds.
- **Four-eyes** — approval workflows are a platform primitive ([05-data-platform.md](05-data-platform.md)): the *requester* needs `x.y.create`, the *approver* `x.y.approve`, and the primitive refuses self-approval (`requested_by ≠ decided_by`) — segregation of duties by construction.

## Audit log (platform primitive, summarized here)

Append-only `audit_log(company_id, actor_user_id, actor_type 'user'|'ai'|'system', action, entity, entity_id, before, after, reason, created_at)` — written by server actions and workers for every mutation; no UPDATE/DELETE grants on the table itself. Permission changes (roles, memberships, delegations) are always audited with before/after.

## Worked examples

1. **Marta (HR Manager, company scope) reads a salary in any team** → `authorize('hr.salary.read', c, team_B, rita)` → membership grants scope `company` → **allowed** (and `is_sensitive` means the grant itself required extra confirmation in the admin UI).
2. **João (Supervisor of Team A, `hr.employee.read:team`) opens an employee of Team B** → scope `team` requires `tm.team_id = team_B`, João's membership is Team A → **denied**: the app hid the row already (same function), and a hand-crafted request dies in RLS.
3. **Rita checks her own payslip** (`hr.payslip.read:own`) → row's `user_id = Rita` → **allowed**; her colleague's payslip → **denied**.
4. **Rita's phone has a stolen 1-factor session** → `aal ≠ aal2` → every `authorize()` returns false → **nothing readable**.
5. **The AI assistant answers João's question** "absences in my team this week?" → tools run with João's JWT → RLS shows Team A only ([06-ai-platform.md](06-ai-platform.md)).

## Admin UX (Phase 1)

Mobile-first screens under `/c/[slug]/settings`: **Teams** (list → members), **Roles** (permission matrix grouped by module, scope picker per row, sensitive permissions flagged), **Members** (invite, assign team+role, suspend), **Delegations** (create time-bound hand-over). Every change lands in the audit log.
