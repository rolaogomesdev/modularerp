# ROADMAP — Soru

**This file is the single source of truth for what to do next.** Every session: pick the next unchecked item in the active phase, meet the Definition of Done in [CLAUDE.md](CLAUDE.md), tick it, add discovered follow-ups. A phase closes only when its exit criteria pass and its manual chapters exist.

Architecture references: [docs/architecture/](docs/architecture/00-overview.md). Legend: `[ ]` todo · `[x]` done.

---

## Phase 0 — Foundation

**Goal**: a deployed, authenticated, multi-company shell — empty but real.

- [x] `git init`, GitHub repo, branch protection on `main` ([rolaogomesdev/modularerp](https://github.com/rolaogomesdev/modularerp))
- [x] Next.js (App Router, TS strict) + pnpm workspaces skeleton (`app/`, `packages/ui|i18n|permissions|ai`, `modules/`) — packages scoped `@repo/*` per ADR-0001 (name stays cheap to change)
  - [ ] Follow-up: unpin ESLint (kept at v9 — eslint-config-next 16's plugins don't support ESLint 10 yet)
- [x] Tailwind + shadcn/ui + token scaffolding (light/dark stubs per [09](docs/architecture/09-design-system.md)) — semantic tokens in `packages/ui` mapped to Tailwind v4 + shadcn bridge; first component (Button); `data-theme` override wiring lands with the Phase 2 profile
- [x] next-intl wired: `pt-PT` + `en` catalogs, no-literal-strings lint rule — locale = cookie override → device language → `pt-PT`; plugin bypassed (Smart App Control blocks `@swc/core`), `next-intl/config` aliased via Turbopack instead
  - [ ] Follow-up: Windows Smart App Control blocks unsigned native npm binaries on this dev machine — verify `sharp` (image optimization) when first used; keep native-dep additions wasm/JS-friendly
- [x] Supabase: staging + prod projects (EU), local CLI dev loop, migration workflow ([05](docs/architecture/05-data-platform.md)) — staging `bhmgdrdlwmixxwxacfwq` + prod `upwdgbjpyenkylqbvfbj` (`eu-central-1`), repo linked to staging, workflow documented in `supabase/README.md`
  - [x] Follow-up: after Windows reboot (WSL2 pending), verify `supabase start` local loop under Docker Desktop — verified 2026-07-06, full stack healthy
- [x] Core migrations: `profiles`, `companies`, `company_members` + RLS ([02](docs/architecture/02-tenancy-and-identity.md)) — AAL2-gated policies, signup trigger, `member_directory` safe view, column-guarded `app_role`; 20 pgTAP RLS tests green (incl. the aal1-reads-nothing exit criterion)
- [x] Auth: email/password sign-up/login, **forced TOTP enrollment**, AAL2 middleware, recovery codes — screens live (pt-PT/en), proxy enforces enroll→challenge→app routing, API-E2E proven to AAL2; recovery = admin/support reset for now
  - [ ] Follow-up: self-service recovery codes (needs a design that keeps service-role out of request paths — golden rule; ADR candidate)
  - [ ] Follow-up: confirm TOTP enroll/verify is enabled on hosted staging + prod (dashboard → Auth → MFA)
  - [ ] Follow-up: browser-level auth E2E (Playwright) lands with the CI item
- [x] Tenancy shell: create company (wizard stub), invite/accept, company switcher, `/c/[slug]` routing — RPCs (aal2-gated, single-use email-bound tokens, token column unreadable), 16 more pgTAP tests, full API E2E green
  - [ ] Follow-up: invitation email sending (link is copy/paste for now); invite revoke UI (Phase 1 with `platform.member.manage`). Done since: return-to-invite redirect (PR #10), pending invitations visible on invitee's home (`my_invitations()`, found by real-user testing)
- [x] CI (GitHub Actions): lint, typecheck, unit, **RLS suite**, build, Vercel previews; deploy pipeline staging → prod — `ci.yml` (quality + pgTAP suite + RLS-coverage gate: tenant table without RLS test = red) and `deploy-db.yml` (staging → prod migrations on main)
  - [ ] Follow-up: Vercel project + previews (needs Vercel account connection — dashboard Git integration or CLI token)
  - [ ] Follow-up: repo secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_STAGING_DB_PASSWORD`, `SUPABASE_PROD_DB_PASSWORD` (deploy workflow guards until set)
  - [ ] Follow-up: company wizard v2 — ask sector (coarse + optional CAE) and size band at creation; progressive profile (NIF when Finance enables)
- [x] Sentry + Vercel Analytics; seed script with demo company + personas — PWA manifest + icons folded in (standalone install works); Sentry env-gated (no-op without DSN); seed: Demo Lda + Marta/João/Rita (`demo-password-123`, local only, login E2E-proven)
  - [ ] Follow-up: create Sentry project + set `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` in Vercel
  - [ ] Follow-up: real app icon from the Sorusoft logo (placeholder = accent square); Serwist service worker (offline) lands with Phase 2/3 offline work
  - [ ] Follow-up: Smart App Control now blocks the local Supabase CLI Go binary — local loop uses `docker exec psql` meanwhile; investigate WSL-distro CLI or signed distribution
- [ ] Compliance stubs: processing register, incident runbook ([07](docs/architecture/07-security-compliance.md))

**Exit criteria**: fresh phone → install PWA → sign up → enroll 2FA → create company → invite a second user who accepts and sees the (empty) company; an `aal1` session reads nothing (test-proven); CI red on a tenant table without RLS test.
**Manual due**: getting-started refreshed against the real flows (screens exist now); sign-in & 2FA page.

## Phase 1 — Permissions core

**Goal**: the two-layer model live end-to-end ([03](docs/architecture/03-permissions.md)).

- [ ] Migrations: `permissions`, `teams`, `company_roles`, `role_permissions`, `team_memberships`; `authorize()` (AAL2-aware); catalog seed from module definitions
- [ ] Role templates seeded at company creation (Owner, HR Manager, Accountant, Supervisor, Employee)
- [ ] `audit_log` primitive + write-path helper (server actions log mutations)
- [ ] Admin UI (`/c/[slug]/settings`): Teams, Members (invite/assign/suspend), Roles matrix (scope picker, sensitive flags), Delegations (time-bound)
- [ ] Escalation guards: can't grant what you don't hold; last-Owner protection (tested)
- [ ] `PermissionGate` + `packages/permissions` pre-check client
- [ ] Full RLS test matrix: personas × scopes × the [03](docs/architecture/03-permissions.md) worked examples

**Exit criteria**: worked examples 1–5 from 03 pass as automated tests; role changes visible in audit log; delegation auto-expires (clock-skewed test).
**Manual due**: concepts page (companies/teams/roles/permissions) verified against UI; company-admin how-tos: create team, build role, assign, delegate.

## Phase 2 — Platform shell & primitives

**Goal**: everything modules will reuse ([05](docs/architecture/05-data-platform.md), [09](docs/architecture/09-design-system.md)).

- [ ] Design system v1: full token set (both themes), component inventory, screen patterns, both-theme visual regression — **including the desktop/big-screen pass**: every pattern defines phone (390px), desktop (sidebar, side sheets, data tables, multi-column detail) and large-display behaviour; modules never write their own breakpoints
- [ ] Navigation shell: bottom tabs / sidebar, company switcher, notifications bell (Realtime), AssistantLauncher stub
- [ ] Personal profile `/me`: avatar, locale, theme override, notification prefs, security self-service (password, 2FA devices, sessions)
- [ ] Primitives: approvals (+ inbox tab, self-approval refused), notifications, comments & attachments, custom fields (defs UI + form/detail/export integration), CSV import (staged) / export (RLS-scoped)
- [ ] Event outbox + jobs worker (pg_cron + Edge Function, dead-letter + alert)
- [ ] `/help` shell serving `docs/manual/` (audience-filtered, searchable)
- [ ] `security_events` collectors: auth hooks, denial counters, export volume (module UI comes in Phase 8)

**Exit criteria**: demo "leave request" toy flow exercises approvals+notifications+audit+events end-to-end on a phone in both themes; a custom field created by an admin appears in form/detail/export untouched by code.
**Manual due**: personal profile & security page; approvals inbox; notifications; import/export how-tos.

## Phase 3 — HR core (first module)

**Goal**: prove the module contract with the module every other one leans on.

- [ ] `modules/hr` registered: permissions, templates, nav, manual chapter ([04](docs/architecture/04-module-system.md))
- [ ] Employees: records (link `company_members`), split `hr_salaries` (sensitive), directory (respecting scopes), employee self-view
- [ ] Contracts: types, dates, renewals warning job
- [ ] Absences: types (PT defaults from rule pack stub), request (offline-capable, [08](docs/architecture/08-mobile-ux.md)), approval flow, team calendar, balances (22-day PT default)
- [ ] Events: `hr.employee.hired/updated/terminated.v1`, `hr.absence.approved.v1`
- [ ] `rpt_hr_*` views: headcount, absences, upcoming renewals
- [ ] Full RLS tests incl. salary-split worked examples

**Exit criteria**: Rita requests an absence on her phone (offline-tolerant), João approves from the inbox, Marta sees balances, salary rows invisible without `hr.salary.read` (test-proven); events consumed by a log-only demo subscriber.
**Manual due**: HR chapter live for all four audiences (request/approve absence, manage employees, salary permissions).

## Phase 4 — Finance core

**Goal**: money in/out with approvals and document intake — clearly marked pre-certification ([07](docs/architecture/07-security-compliance.md) ⚠️).

- [ ] `modules/finance`: customers/suppliers, expenses (capture → approve → export), internal/pro-forma invoicing (ATCUD/QR + SAF-T fields modeled; "not yet AT-certified" banner)
- [ ] Document intake: camera/PDF → Storage → extraction draft → human confirm ([06](docs/architecture/06-ai-platform.md) surface 3, Haiku)
- [ ] Approval thresholds (amount-based routing), duplicate detection
- [ ] Events (`finance.expense.approved.v1`, …); `rpt_finance_*` views; RLS tests
- [ ] Subscribes: `hr.employee.hired` → payroll cost stub

**Exit criteria**: photograph a receipt → confirmed expense → approved via inbox → exported CSV matches; SAF-T structure validates against schema (even if pre-certification).
**Manual due**: Finance chapter (capture expense, approve, invoicing status/limits explained honestly).

## Phase 5 — AI foundation

**Goal**: all four AI surfaces live under full guardrails ([06](docs/architecture/06-ai-platform.md)).

- [ ] `packages/ai` gateway: model routing, per-surface tool allowlists, `ai_actions` audit, `ai_usage` budgets + kill-switch, zod tool inputs
- [ ] RAG: `doc_chunks` + ingestion job (manual + architecture + PT legislation corpus), audience/permission-filtered retrieval
- [ ] Help assistant in AssistantLauncher: grounded answers with exact `path`, deep-link navigation, permission-aware refusals
- [ ] Data analyst: `list_report_views`/`query_report`/`render_chart` over `rpt_*` (user JWT, security_invoker)
- [ ] Rule packs: schema + admin review/approve UI (`compliance.rules.approve`), PT `leave` + `payroll` v1 with citations; HR balances read from pack
- [ ] Golden Q&A eval sets in CI; feedback capture (`ai_feedback`)

**Exit criteria**: João asks "who's out next week in my team?" → correct, team-scoped answer with provenance; assistant walks Rita to absence request via deep link; AI-drafted rule-pack diff activates only after human approval and flips HR defaults on effective date; budget cap degrades gracefully.
**Manual due**: assistant chapter per audience (what it can/can't do, budgets, feedback), compliance review how-to.

## Phase 6 — Production

**Goal**: the shop-floor test of mobile + offline + team scopes.

- [ ] `modules/production`: work centers, work orders (statuses, assignments), shift terminal UI (large targets, offline-tolerant per [08](docs/architecture/08-mobile-ux.md))
- [ ] Offline mutation queue proven here (idempotency keys, server-wins, inbox reconciliation)
- [ ] Team-scoped everything (João's Supervisor template); `rpt_production_*`; events; RLS tests

**Exit criteria**: complete a work order in airplane mode → reconnect → state converges, audit correct; supervisor sees only their team's orders (test-proven).
**Manual due**: Production chapter incl. offline behaviour explained for members.

## Phase 7 — Hardening & PT launch readiness

**Goal**: polish what exists; no new surface.

- [ ] PT translation pass over the manual (EN → pt-PT) + in-app copy audit
- [ ] Performance: budgets from [08](docs/architecture/08-mobile-ux.md) enforced in CI; real-device pass
- [ ] Security review: threat-model walkthrough ([07](docs/architecture/07-security-compliance.md)), secrets rotation drill, restore drill, pen-test-style RLS probe session
- [ ] GDPR: DSR export/erasure jobs live; processing register + retention sweeps verified
- [ ] Rule packs: PT `invoicing` + `social_security` complete; AT-certification decision ADR (pursue vs partner)
- [ ] Observability: dashboards (errors, jobs, outbox lag, AI spend), on-call basics

**Exit criteria**: restore drill passes; DSR round-trip on demo data; all manual pages `status: live` with PT locale; Lighthouse mobile ≥ 90 on core flows.
**Manual due**: everything current — drift check via the "Docs health check" prompt ([PROMPT.md](PROMPT.md)).

## Phase 8 — Security module v1 (IDS for company security teams)

**Goal**: the `security` module from [07](docs/architecture/07-security-compliance.md) — per-company intrusion detection & security operations.

- [ ] `modules/security` registered; `security.*` permissions + **Security Officer** template (no business-data access)
- [ ] Detections v1 over `security_events`: brute force, impossible travel/new device, denial spikes, mass export, off-hours privilege changes, dormant-account activity, AI anomalies
- [ ] Screens: Overview, Alerts (triage → resolve with notes), Audit explorer, Posture (stale invites, over-privileged members, SoD warnings, delegation inventory), Policies (thresholds, routing)
- [ ] Platform twin: same stream feeding operator dashboards/alerts

**Exit criteria**: simulated brute force + mass export raise alerts a Security Officer triages on a phone; Officer role provably cannot read business data (RLS tests).
**Manual due**: Security chapter (security-team audience) + member-facing "what we monitor and why" transparency page.

---

## Later / ideas (parking lot)

- **Training module** (courses, certifications, mandatory training — linked to HR records)
- **Bookings module** (appointments/reservations — the small-company entry point; resource + staff calendars, AI scheduling assistant)
- **Checklists module** (production/operation/safety checklists: template builder, scheduled runs, mobile execution, AI review of answers) — small; good early proof of the module contract after HR
- **Tickets module** (one module, configurable queues: software/IT, production/maintenance, internal requests; SLA timers, AI triage/dedup/suggested resolutions from RAG; consumes events — e.g. failed work order → auto-ticket)
- **KPIs as first-class objects**: definitions + targets + thresholds over `rpt_*` views; module-default KPI seeds in the registry; cross-module executive dashboard; design Phase 2 StatCards with target/threshold states from day one
- **TV/kiosk display mode**: admin-created display tokens scoped to one dashboard + narrow permissions (never a user session on a wall); auto-refresh via Realtime, read-only, big-typography layout, revocable from settings — production boards, KPI walls
- **Module entitlements/billing**: modules as sellable products (plans decide what `company_modules.enabled` may be flipped); supersedes the bare "billing/plans" line (ADR when designed)
- **Cross-module AI insights ("the spider web")**: a fifth AI surface that proactively correlates KPIs, events and rule packs across enabled modules and posts cited, suggestion-only insights into notifications; each purchased module densifies the web (per-user permission-scoped, as always)
- **Enterprise readiness track** (the long-term SAP-alternative climb, in order): public API + webhooks over the event outbox (events are already versioned contracts) → legacy migration tooling (Primavera/Sage/SAP imports) → SCIM provisioning → per-tenant isolation options + data residency → sandbox companies → partner/implementer program. Beachhead first: the underserved 20–300-employee middle.
- Per-company **SSO** (AD/Entra ID, Google, Microsoft) + directory sync (AD groups → teams); break-glass support access (consented, audited)
- More countries (rule packs + locale packs); accounting module + SAF-T accounting variant; Relatório Único
- Inventory, Sales/CRM, Procurement, Projects modules
- Web push notifications; WebAuthn/biometric factor; native app wrapper (only if PWA proves insufficient)
- AI: anomaly-detection models for Security; scheduled analyst reports v2; onboarding copilot
- Sandbox/training company generator; team-hierarchy scope cascade (ADR needed)
