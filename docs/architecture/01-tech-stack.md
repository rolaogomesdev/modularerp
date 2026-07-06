# 01 — Tech stack

Demo-cost stack, production-shaped architecture. Every choice below states its *why*; contested choices get ADRs.

## Application

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript (strict)** | One codebase for mobile-first UI and server logic; Server Components keep payloads small on phones; first-class on Vercel. |
| UI | **Tailwind CSS + shadcn/ui** in `packages/ui` | shadcn/ui gives accessible primitives we own and can theme with tokens; no dependency on a component vendor. |
| Data fetching | **Server Components + Server Actions**; **TanStack Query** on the client only where interactivity needs it (live lists, offline queue) | Fewest moving parts; Query's cache persistence powers the offline read cache ([08-mobile-ux.md](08-mobile-ux.md)). |
| Validation | **Zod** at every boundary (forms, server actions, AI tool inputs, import files) | One schema → form types, runtime validation, AI tool JSON schemas. |
| i18n | **next-intl**, locales `pt-PT` (primary) and `en` | Message catalogs per locale; no hard-coded strings (lint-enforced). |
| PWA | **Serwist** service worker + web manifest | Installable, offline read cache, mutation queue. |

## Backend (Supabase, EU region)

| Concern | Choice | Why |
|---|---|---|
| Database | **Postgres + RLS everywhere** | The permission model is enforced in the database ([03-permissions.md](03-permissions.md)); any future client (mobile native, API) inherits it. |
| Auth | **Supabase Auth**: email/password + **mandatory TOTP 2FA (AAL2)**; per-company SSO (Entra ID/AD, Google, Microsoft) reserved | See [02-tenancy-and-identity.md](02-tenancy-and-identity.md). |
| Files | **Supabase Storage** (per-company buckets/prefixes, RLS-checked) | Documents, avatars, invoice photos. |
| Realtime | **Supabase Realtime** | Notifications inbox, approval badges, live lists. |
| Vectors | **pgvector** in the same Postgres | RAG for legislation + manual without a second datastore. |
| Jobs/events | **Postgres tables (outbox, jobs) + pg_cron + Edge Function workers** | No external queue to operate; see [05-data-platform.md](05-data-platform.md). |
| Server client | `@supabase/ssr` with cookie sessions; **service-role key only in the outbox/job workers, never in request paths or AI tools** | Keeps RLS as the single enforcement point. |

## AI

Single server-side gateway in `packages/ai` calling the **Claude API**: Sonnet (`claude-sonnet-5`) as default workhorse, Haiku for high-volume extraction/classification, Opus-tier reserved for legislation drafting. Model routing is a table in code, not scattered call sites. Full design in [06-ai-platform.md](06-ai-platform.md).

## Repository

**pnpm workspaces, single Next.js app** (no Turborepo until build times hurt — ADR when it does):

```
app/                    Next.js App Router (shell, auth, /c/[company]/<module> routes)
modules/<key>/          business modules: ui/, server/, domain/, module.ts (registry entry)
packages/ui/            design system (tokens, components, patterns)
packages/i18n/          locale packs
packages/permissions/   permission client (keys, authorize pre-checks, PermissionGate)
packages/ai/            AI gateway, tools, RAG ingestion
supabase/               migrations/, seed/, functions/ (edge), tests/ (RLS)
docs/architecture/      these documents + adr/
docs/manual/            user manual (help assistant corpus)
ROADMAP.md              living roadmap
```

## Environments

| Env | Where | Data | Notes |
|---|---|---|---|
| Local | `supabase start` (Docker) + `next dev` | Seeded demo company | Everything runs offline; seeds create the personas from [00-overview.md](00-overview.md). |
| Preview | Vercel preview per PR | Points at **staging** Supabase project | Never at prod. |
| Production | Vercel + Supabase prod project (EU) | Real | Migrations applied by CI on merge to `main`. |

Two Supabase projects (staging, prod) — free/pro tier is fine for the demo.

## CI/CD (GitHub Actions)

On every PR: 1) lint + typecheck, 2) unit tests (Vitest), 3) `supabase start` → apply migrations → **RLS test suite** (the gate that matters — see [07-security-compliance.md](07-security-compliance.md)), 4) build, 5) Vercel preview deploy. On merge to `main`: migrate staging → run RLS suite → migrate prod → deploy. A PR that adds a tenant table without RLS tests fails CI.

## Observability

Sentry (client + server) for errors; Vercel Analytics for web vitals (mobile budgets in [08-mobile-ux.md](08-mobile-ux.md)); structured logs from Edge Function workers into Supabase logs. Per-company AI spend tracked in `ai_usage` ([06-ai-platform.md](06-ai-platform.md)).

## Explicitly not now

- No Turborepo/Nx, no microservices, no external queue (Postgres does it), no Kubernetes.
- No native mobile app — the PWA must prove insufficient first (parking lot).
- No GraphQL — Server Actions + typed queries.
