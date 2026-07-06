# 05 — Data platform

One Postgres, one shared schema, row-isolated by `company_id` + RLS ([ADR-0002](adr/ADR-0002-tenancy-model.md)). This doc fixes the conventions every table, event, job and import follows.

## Schema conventions (every tenant table)

```sql
create table hr_absences (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id),
  -- scoping columns used by authorize(): whichever apply to the entity
  team_id     uuid references teams(id),
  user_id     uuid references profiles(id),      -- "who this row is about"
  -- domain columns...
  status      text not null default 'pending',
  custom      jsonb not null default '{}',        -- custom fields (below)
  created_at  timestamptz not null default now(),
  created_by  uuid not null,
  updated_at  timestamptz not null default now(), -- touch trigger
  deleted_at  timestamptz                          -- soft delete; hard delete only via GDPR jobs
);
create index on hr_absences (company_id, team_id);
create index on hr_absences (company_id, user_id);
alter table hr_absences enable row level security;  -- + policies per 03-permissions.md
```

Rules: UUID PKs; `company_id NOT NULL` on every tenant table; composite indexes lead with `company_id`; module prefix on table names (`hr_`, `finance_`); soft delete (`deleted_at`) — status changes over row deletion for business records; money as `numeric(12,2)` + currency from the company; timestamps `timestamptz` UTC, rendered in company timezone.

## Migrations workflow

- Files in `supabase/migrations/NNNN_<module>_<what>.sql`, generated with `supabase db diff` against local, **reviewed as code** — applied migrations are never edited.
- Every migration that creates a tenant table ships in the same PR with: RLS policies, permission seeds (if new keys), RLS tests, and updated seed data.
- CI: apply to ephemeral local DB → RLS suite → on merge: staging → prod ([01-tech-stack.md](01-tech-stack.md)).
- Idempotent seeds (`supabase/seed/`): permission catalog sync from module definitions, role templates, demo company with the personas from [00-overview.md](00-overview.md).

## Event outbox (module integration)

Modules never call each other — they publish events; the outbox guarantees delivery.

```sql
create table events (
  id           bigint generated always as identity primary key,
  company_id   uuid not null,
  name         text not null,                  -- 'hr.employee.hired.v1'
  payload      jsonb not null,                 -- zod-validated at publish
  actor        jsonb not null,                 -- {type:'user'|'ai'|'system', id}
  created_at   timestamptz not null default now(),
  processed_at timestamptz,
  attempts     int not null default 0,
  last_error   text
);
```

- **Publish** happens in the same transaction as the business write (that's the point of an outbox — no lost or phantom events).
- **Dispatch**: pg_cron (every minute) invokes an Edge Function worker → claims rows `FOR UPDATE SKIP LOCKED` → runs each subscriber handler → marks processed. Retries with backoff up to 5 attempts, then **dead-letter** (`events_dead`) + platform alert.
- Handlers are **idempotent** (event id dedup) — delivery is at-least-once.
- Naming `module.entity.verb.vN`; payload schemas exported from the module's `public.ts` and versioned ([04-module-system.md](04-module-system.md)).
- The events table doubles as an integration audit: the Security module ([07](07-security-compliance.md)) and debugging read it.

## Background jobs

```sql
create table jobs (
  id          bigint generated always as identity primary key,
  company_id  uuid,                            -- null = platform job
  kind        text not null,                   -- 'finance.saft_export', 'ai.rag_ingest'
  payload     jsonb not null default '{}',
  run_at      timestamptz not null default now(),
  status      text not null default 'queued',  -- queued|running|done|failed|dead
  attempts    int not null default 0,
  last_error  text
);
```

Same worker pattern as the outbox (claim → run → complete/retry). Scheduled jobs (rule-pack refresh checks, digest notifications, retention sweeps) are pg_cron entries that enqueue job rows. Job handlers are registered by modules (`jobs` in `ModuleDefinition`). Workers are the **only** code allowed the service-role key — every write they make carries an explicit `company_id` and lands in the audit log as `actor_type='system'`.

## Reporting views (stable read contracts)

Each module exposes `rpt_*` views over its own tables — the only cross-module/AI-visible read surface:

```sql
create view rpt_hr_headcount with (security_invoker = true) as
  select company_id, team_id, count(*) as headcount, ...
  from hr_employees where deleted_at is null group by 1, 2;
```

`security_invoker = true` means RLS of the underlying tables applies to the *caller* — the AI data analyst queries these views with the user's JWT and physically cannot see more than the user ([06-ai-platform.md](06-ai-platform.md)). Views are contracts: additive changes only.

## Custom fields

Every ERP needs "just one more field" without a migration:

```sql
create table custom_field_defs (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  entity     text not null,          -- 'hr_employees', 'finance_invoices'
  key        text not null,          -- snake_case, immutable once created
  label      jsonb not null,         -- localized
  type       text not null,          -- text|number|date|select|multi_select|boolean
  config     jsonb not null default '{}',   -- options, min/max, required
  position   int not null default 0,
  archived_at timestamptz,
  unique (company_id, entity, key)
);
```

Values live in the row's `custom jsonb` column; server actions validate against the defs (zod built at runtime); GIN index when a company actually filters on them. Custom fields appear automatically in forms, detail views, exports and the AI's schema description.

## Import / export

- **Import**: per-entity CSV templates (localized headers) → staged into `import_batches` + rows with per-row validation results → user reviews errors on a mobile-friendly screen → commit applies via the normal server actions (so RLS, audit and events all fire). Never `COPY` straight into business tables.
- **Export**: any list screen exports CSV of exactly what the caller can see (RLS does the filtering by construction). Country-mandated exports (e.g. SAF-T PT) are Finance-module jobs ([07](07-security-compliance.md)).
- **GDPR export/erasure**: platform jobs — per-person data export; erasure = anonymization of personal columns while preserving accounting integrity (details in [07](07-security-compliance.md)).

## Data lifecycle

- Backups: Supabase PITR + weekly logical dump per environment to Storage.
- Retention: per-table policy documented with the table; enforced by a scheduled `retention_sweep` job (e.g. notifications 90d, audit_log ≥ legal minimum, never less than 1y).
- Archival (cold companies, closed fiscal years): parking lot until data size demands it.
