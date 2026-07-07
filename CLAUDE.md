# CLAUDE.md — Soru (by Sorusoft)

Mobile-first, AI-native, **modular ERP**: one web application that manages a company end-to-end — HR, Finance, Production, Inventory, Sales, and more — multi-company, multi-country, with granular team/role permissions and an AI layer that analyses data and tracks legislation per country.

Demo stack: **GitHub + Vercel + Supabase**.
App: **Next.js (App Router, TypeScript) + Tailwind + shadcn/ui**, installable PWA.
Data: **Postgres via Supabase** (Auth, RLS, Storage, Realtime, Edge Functions, pgvector).
AI: **Claude API** (Sonnet 5 as default workhorse, Haiku for high-volume extraction) behind a single server-side gateway.

## Founding decisions (ADR-0001)

- Product name **"Soru"**, company **Sorusoft** (ADR-0003; formerly working title "Modular ERP") — the rename-stays-cheap rule survives: never bake the name into identifiers, schemas or URLs.
- Launch market **Portugal** (PT primary, EN secondary); more countries later via country rule packs + locale packs, never by touching module code.
- Module order: **HR → Finance → Production**, then the Security module (intrusion detection & tooling for company security teams — roadmap Phase 8) and Training (HR-family: courses, certifications).
- Auth: Supabase **email/password + mandatory TOTP 2FA**. Per-company SSO (AD/Entra ID, Google, Microsoft) is a designed-for upgrade; 2FA stays enforced regardless of provider.
- Every user has a global **personal profile** (avatar, language, theme, notifications, security/2FA self-service) — separate from the per-company employee record owned by HR.
- Themes: **light + dark from day 1** via design tokens; default follows the device, per-user override in the personal profile.

## Golden rules (apply to every session)

1. **Docs move with code.** A feature is not done until the relevant `docs/manual/` pages and `ROADMAP.md` are updated in the same commit/PR. Significant decisions get an ADR in `docs/architecture/adr/`.
2. **Security lives in the database.** Every tenant table has `company_id` and an RLS policy. The app layer checks permissions for UX only; Postgres enforces them. A new table without an RLS policy is a bug.
3. **AI proposes, humans approve.** AI never mutates business data or activates compliance rules without an explicit, permission-checked human approval. Every AI action lands in the audit log. AI data access runs *as the requesting user* — never with the service role.
4. **Mobile first.** Design every screen for a phone (test at 390 px wide); desktop is the enhancement.
5. **i18n from day 1.** No hard-coded user-facing strings. Manual and legislation content is locale- and country-scoped.
6. **Modules are plug-ins.** A new business capability is a new module registered in the module registry (routes, nav, permission catalog, migrations, events, jobs, manual chapter). Modules never import each other's internals — they integrate via the event outbox and public service APIs. Modules can be enabled per company.
7. **One design system, everywhere.** Every screen in every module is composed exclusively from `packages/ui` components, design tokens and the standard screen patterns (list → detail → edit, filters, empty/loading/error states, forms, approval banners). No module-local styling or one-off components — a user who learns one module has learned them all. Per-company branding (logo, accent color) is applied through tokens, never by restyling components.

## Permission model (two layers — never blur them)

- **App roles** (platform level, per user): `platform_admin`, `support`, `user`. They govern the platform itself and give **zero** access to company business data.
- **Company layer**: Company → **Teams** → **Company roles** → granular **permissions**.
  - Permission keys: `module.resource.action` with scope `own | team | company` (e.g. `hr.absence.approve:team`, `finance.invoice.read:company`).
  - Modules seed the permission catalog. Companies compose roles as named permission sets (system templates provided: Owner, HR Manager, Accountant, Supervisor, Employee).
  - Assignment: `team_membership(user, team, company_role)` — a user holds a role *within* a team. Effective permissions = union across memberships; `team`-scoped permissions apply only to that team's resources.
  - Resolution is a Postgres function used both by RLS policies and by the app for UX pre-checks.
- Platform primitives on top: append-only audit log, approval workflows (four-eyes), time-bound delegation, field-level sensitivity (e.g. salaries).

## Repo layout (target)

```
app/                 Next.js App Router: shell, auth, company switcher, settings, /help
modules/<name>/      one folder per business module (ui, api, domain, permissions, events, manual/)
packages/            shared: ui kit, i18n, permission client, ai client
supabase/            migrations, seed data, edge functions, RLS tests
docs/architecture/   architecture docs + adr/
docs/manual/         user manual by audience (see below)
ROADMAP.md           living roadmap — single source of truth for what to do next
PROMPT.md            kickoff mission + reusable session prompts
```

## Conventions

- **DB**: UUID PKs; `company_id` on every tenant table; `created_at`/`created_by`; soft delete via `deleted_at`; migrations only via `supabase/migrations` (never edit an applied migration).
- **Events**: outbox table + dispatcher; names are `module.entity.verb` (`hr.employee.hired`), so e.g. payroll reacts to hires without HR knowing about payroll.
- **Manual audiences**: `platform-admin`, `company-admin`, `team-manager`, `member` — plus per-module chapters. The manual is served in-app at `/help` and, together with `docs/architecture/`, is the knowledge base of the AI help assistant. Every manual page carries front-matter (`audience`, `module`, `feature`, `permissions`, `path` — the exact in-app navigation, `countries`, `status`, `updated`), and every how-to states the exact navigation path and required permission; assistant retrieval filters by the asking user's audience and permissions.
- **Testing**: RLS policy tests are mandatory for every new table; Playwright smoke tests for critical mobile flows.

## Definition of Done (any roadmap item)

- [ ] Code + migrations + RLS policies + permission catalog entries
- [ ] Manual page(s) updated for every affected audience
- [ ] `ROADMAP.md` checkbox ticked; newly discovered work added as follow-ups
- [ ] Mutations covered by the audit log; events published where other modules care
- [ ] Works at 390 px; all strings i18n'd; RLS tests pass
