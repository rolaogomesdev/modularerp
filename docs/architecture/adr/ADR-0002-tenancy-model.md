# ADR-0002 — Tenancy model: shared database, row-level isolation

- **Status**: Accepted
- **Date**: 2026-07-06
- **Deciders**: Product owner (asked "different tenants or same database?"), Claude (founding architect)

## Context

The app hosts many companies. Three standard models:

1. **Database per tenant** — strongest physical isolation; but with Supabase that means one *project* per customer: N× migrations, N× auth, N× monitoring, N× cost. Cross-tenant features (one user in several companies, platform admin, shared AI infra) become integration projects. Unmanageable for a small team and impossible to demo cheaply.
2. **Schema per tenant** — one database, one schema per company. Middle ground, but migrations still run N times, PostgREST/Supabase tooling assumes one schema, connection pooling suffers, and RLS is still needed for shared tables. Most of the cost of #1, few of the benefits.
3. **Shared schema, row-level isolation ("pool")** — every tenant table carries `company_id`; **Postgres RLS** enforces isolation on every query, resolved through the permission function ([03-permissions.md](../03-permissions.md)).

## Decision

**Model 3: one database, shared schema, `company_id` + RLS on every tenant table.**

Product requirements that force it: users belong to multiple companies with instant switching; app roles operate above all tenants; one AI gateway/RAG store; migrations and rule packs deploy once for everyone.

Isolation posture: the database — not the app — is the boundary. Even a buggy app query cannot cross tenants because policies are evaluated in Postgres. CI runs a cross-tenant leak test suite on every PR ([07-security-compliance.md](../07-security-compliance.md)). In practice this is stronger than "separate DBs but the app picks the connection string", where one routing bug leaks everything.

## Guardrails that keep this safe

- RLS enabled on **every** tenant table; a table without a policy is a bug (CI-checked).
- `company_id NOT NULL` + composite indexes leading with `company_id`.
- Storage paths and vector chunks also carry/company-filter `company_id`.
- Service-role key confined to outbox/job workers; never in request paths or AI tools.
- Per-company rate limits and AI budgets contain noisy neighbours.
- Backups: PITR for the platform + per-company logical export (also serves GDPR export).

## Escape hatch

All tenant data is keyed by `company_id` with UUID PKs and no cross-company FKs, so a single company can be lifted into a dedicated Supabase project (dedicated "cell") if an enterprise contract ever demands physical isolation. That is a migration, not a redesign.

## Consequences

- Every migration, module and feature must follow the schema conventions in [05-data-platform.md](../05-data-platform.md).
- Partitioning by `company_id` is available later if one table grows hot; not now.
