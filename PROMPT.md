# Claude Code kickoff prompt — Modular ERP

**How to use:** open Claude Code in this folder and paste everything below the line — or simply say:

> Read PROMPT.md and execute the kickoff mission.

Reusable prompts for later sessions are at the bottom of this file.

---

## Kickoff mission

You are the founding architect and lead engineer of a new product: a **mobile-first, AI-native, modular ERP** — one web application that manages a company from start to finish (HR, Finance, Production, Training (HR Management, and Training Management), Inventory, Sales/CRM, Procurement, Projects, …). You will design it, document it, and build it incrementally over many sessions. `CLAUDE.md` holds the standing rules — read it first and treat it as authoritative.

**This session produces documents only** (no app code): the architecture, the living roadmap, and the user-manual skeleton. Implementation starts next session with Phase 0 of the roadmap.

### Product requirements (non-negotiable)

1. **Platform**: web app optimized for mobile (installable PWA). Demo deployment: GitHub + Vercel + Supabase. Next.js App Router + TypeScript.
2. **Multi-company**: one deployment hosts many companies; a user can belong to several companies and switch between them.
3. **Modular**: HR, Finance and Production first, but adding a module must be cheap. Design a **module registry**: each module declares its routes, navigation, permission catalog, migrations, events, background jobs and manual chapter. Modules are enabled per company and never import each other's internals — they integrate through an event outbox (`hr.employee.hired` → payroll reacts).
4. **Two-layer permission model** (keep the layers strictly separate):
   - **App roles** (platform): `platform_admin`, `support`, `user` — govern the platform itself, zero access to company business data.
   - **Company layer**: Company → **Teams** → **Company roles** carrying **granular permissions**. Permission keys are `module.resource.action` with scope `own | team | company`. Users are assigned a role *within* a team (`team_membership(user, team, role)`); effective permissions are the union across memberships, with team-scoped permissions limited to that team's resources. Companies compose custom roles from the permission catalog; ship templates (Owner, HR Manager, Accountant, Supervisor, Employee).
   - Enforcement lives in **Postgres RLS** via a permission-resolution function; the app layer only pre-checks for UX.
   - Design in from the start: append-only audit log, approval workflows (four-eyes), time-bound delegation (vacation hand-over), field-level sensitivity (salaries).
5. **AI platform** (first-class, not bolted on):
   - **Data analyst**: natural-language questions over company data → permission-scoped queries (the AI acts *as the requesting user*, never with the service role) → answers, charts, scheduled reports.
   - **Legislation engine**: per-country **rule packs** — versioned, effective-dated, machine-readable rules (tax rates, withholding tables, overtime multipliers, vacation accrual, invoicing mandates) where every rule carries citations to the source law. The AI ingests legislation (RAG over pgvector) and *drafts* rule-pack updates; only a human with `compliance.rules.approve` can activate them. Modules read active rule packs — they never hard-code law.
   - **Module copilots**: draft HR contracts, categorize expenses, reconcile bank statements, forecast cash flow, flag anomalies and duplicates; document intelligence (photo/PDF of an invoice → structured entry, human confirms).
   - **In-app help assistant** grounded on the user manual *and* the architecture docs (RAG over `docs/manual/` + `docs/architecture/`), so it can both answer "how do I…" questions and navigate users to the exact screen.
   - **Guardrails**: human approval for every AI-proposed mutation; every AI action audited; per-company AI budgets; PII-aware prompting. One server-side AI gateway using the Claude API.
6. **Manual for every audience**, written as features ship: `platform-admin`, `company-admin`, `team-manager`, `member`, plus per-module chapters. Served in-app at `/help`, mobile-friendly, searchable. The manual **and** the architecture docs are the help assistant's knowledge base: every page carries front-matter (`audience`, `module`, required `permissions`, exact in-app `path` such as "Settings → Teams → Roles", `countries` applicability, `status`), and every how-to states the exact navigation path and the permission it needs — that is what lets the assistant walk a user to the right screen instead of answering vaguely. Assistant retrieval filters by the asking user's audience and permissions.
7. **i18n and multi-country from day 1**: launch market is **Portugal** (PT primary, EN secondary); more countries come later via country rule packs and locale packs — adding a country must never require touching module code. GDPR-compliant by design: data export/erasure, processing register, EU hosting region.
8. **Platform primitives** built once, reused by every module: audit log, approvals, notifications/inbox, comments & attachments, custom fields, CSV import/export, event outbox, feature flags, background jobs, onboarding wizard that applies the country rule pack's defaults to a new company.
9. **Persistent UX/UI across the whole application**: one design system that every module must use — design tokens (color, spacing, typography, radius, motion), a shared component library (`packages/ui`, shadcn/ui-based), standard screen patterns (list → detail → edit, filters, search, empty/loading/error states, forms with inline validation, approval banners), one navigation shell, and **light + dark themes from day 1** (default follows the device, per-user override in the personal profile). Per-company branding (logo, accent color) is applied via tokens only. A user who learns one module has learned them all; a screen that doesn't use the design system fails review.
10. **Identity & personal profiles**:
    - Demo auth: **Supabase email/password with mandatory 2FA (TOTP)**. 2FA is enforced regardless of how a user authenticates, now and in the future.
    - Design the upgrade path now: a company can later connect its own identity provider — **Active Directory / Microsoft Entra ID, Google Workspace, or Microsoft accounts** — via per-company SSO configuration (domain-routed sign-in), without changes to the permission model.
    - Every user has a **personal profile**: avatar, display name, contact info, language (PT/EN), theme, notification preferences, and security self-service (password change, 2FA devices, active sessions). This profile is global to the account and **separate from the per-company employee record owned by HR** — leaving a company never deletes the person's account, and HR data never leaks across companies.

### Step 0 — Record the founding decisions (already made — do not re-ask)

Record these in `docs/architecture/adr/ADR-0001-founding-decisions.md`:

1. **Product name**: "Modular ERP" (working title). Renaming later must stay cheap — never bake the name into identifiers, schemas or URLs.
2. **Launch market**: Portugal — PT primary, EN secondary. Other countries later via rule packs + locale packs.
3. **Module order**: **HR first**, then Finance, then Production; Training (course & certification management) follows as an HR-family module. Rationale: every other module references people, teams and roles, and HR exercises the permission system hardest (salaries → field-level sensitivity; absences → approval workflows).
4. **Auth**: Supabase email/password + **mandatory TOTP 2FA** for the demo; per-company SSO (AD/Entra ID, Google, Microsoft) is a designed-for upgrade, with 2FA enforced regardless of provider.
5. **Themes**: light + dark from day 1 via design tokens; default follows the device, per-user override in the personal profile.

Use AskUserQuestion only if you hit a genuinely new decision these don't cover.

### Step 1 — Write the architecture (`docs/architecture/`)

Concrete and opinionated — real table definitions, TypeScript interfaces, Mermaid diagrams, worked examples. Not generalities.

- `00-overview.md` — vision, personas, module map, system-context diagram.
- `01-tech-stack.md` — Next.js/Vercel/Supabase/Claude choices and *why*; local dev with the Supabase CLI; environments; CI/CD with GitHub Actions and Vercel preview deploys per PR.
- `02-tenancy-and-identity.md` — companies, users, app roles vs company roles, invitations, company switching, session model; the auth stack (email/password + mandatory TOTP 2FA now; per-company SSO via AD/Entra ID, Google or Microsoft later — provider config per company, domain-routed sign-in, 2FA always enforced); personal profile (account-global) vs employee record (per-company, HR-owned).
- `03-permissions.md` — the two-layer model in full: permission catalog, roles, teams, memberships, the SQL resolution function, RLS policy patterns per scope, delegation, audit. Include worked examples ("an HR manager of Team A tries to read a salary in Team B").
- `04-module-system.md` — module registry interface (TypeScript), module folder contract, what a module declares, per-company enablement, versioning.
- `05-data-platform.md` — schema conventions, migration workflow, event outbox, background jobs, reporting views, custom fields, import/export.
- `06-ai-platform.md` — gateway design, model selection, tool-use patterns, permission-scoped data access, the RAG pipelines (legislation; manual + architecture docs for the help assistant, with audience/permission-aware retrieval and navigation-path metadata so the assistant gives exact in-app directions), rule-pack schema and approval flow, budgets, audit, evaluation approach.
- `07-security-compliance.md` — threat model, RLS testing strategy, secrets handling, GDPR duties, country compliance packs (use the first country as the worked example — e.g. for Portugal: SAF-T, ATCUD/QR invoicing, IRS withholding, TSU), backup/restore.
- `08-mobile-ux.md` — PWA strategy, offline approach (read cache + queued mutations for shop-floor use), navigation shell, accessibility.
- `09-design-system.md` — the persistent UX/UI contract: design tokens, component inventory, standard screen patterns with wireframe sketches, navigation shell spec, dark/light mode, per-company theming rules, motion, WCAG targets — and how consistency is enforced (module review checklist, lint rules, no styles outside `packages/ui`).
- `adr/` — ADR-0001 plus one ADR per contested choice you make along the way.

### Step 2 — Write the roadmap (`ROADMAP.md`)

Phased and checkbox-driven; each phase has a goal, deliverables, **exit criteria**, and **manual chapters due**. Suggested skeleton (adapt to Step-0 answers):

- **Phase 0 — Foundation**: git/GitHub repo, Next.js scaffold, Supabase project + CLI, CI, auth (email/password + mandatory TOTP 2FA), tenancy shell (create/switch company).
- **Phase 1 — Permissions core**: catalog, teams, roles, memberships, resolution function, RLS harness + tests, roles admin UI.
- **Phase 2 — Platform shell & primitives**: design system v1 (tokens, core components, screen patterns, light/dark themes), mobile navigation, personal profile (avatar, language, theme, notifications, 2FA self-service), audit log, notifications, approvals, custom fields, event outbox, /help shell.
- **Phase 3 — First module (HR core)**: people, contracts, absences with approval flow.
- **Phase 4 — Finance core**: invoicing, expenses, approvals, document intelligence intake.
- **Phase 5 — AI foundation**: gateway, data analyst, legislation RAG + first rule pack, help assistant.
- **Phase 6 — Production**: work orders, shop-floor mobile flows (offline-tolerant).
- **Phase 7 — Hardening**: i18n polish, offline, compliance pack v1, observability, load/RLS audit.
- **Phase 8 — Security module**: per-company intrusion detection & security operations for company security teams — alerts (brute force, impossible travel, mass export, privilege changes), audit explorer, posture view; `security.*` permissions so security officers see signals without business data.
- **Later / ideas**: parking lot, seeded with — Training module (courses, certifications, mandatory/compliance training, linked to HR records), per-company SSO (AD/Entra ID, Google, Microsoft), additional countries, Inventory, Sales/CRM, Procurement, Projects.

The roadmap is the single source of truth for what to do next; every session updates it.

### Step 3 — Seed the manual (`docs/manual/`)

Create the audience structure and write the evergreen parts for real: getting-started per audience, and platform concepts (companies, teams, roles, permissions, personal profile) explained in user language, not developer language. Stub per-module chapters with front-matter marking them "written when the feature ships".

Define the front-matter schema every manual page must carry — `audience`, `module`, `feature`, `permissions` (needed to use the feature), `path` (exact in-app navigation, e.g. "Settings → Teams → Roles"), `countries`, `status`, `updated` — and the writing rule that every how-to includes the exact navigation path and required permission. This metadata is what the in-app AI assistant uses to give users precise, permission-aware directions. Add `docs/manual/README.md` stating these rules: audience tone, front-matter schema, updated with every feature, source of truth for in-app help.

### Step 4 — Wrap up

Update `CLAUDE.md` if any Step-0 decision changed it. Print a summary of everything created and stop. Wait for the user to say **"start phase 0"**.

---

## Reusable prompts for later sessions

**Continue building**
> Read CLAUDE.md and ROADMAP.md. Take the next unchecked roadmap item, implement it end-to-end (code, migrations, RLS + tests, manual pages, roadmap tick) until the Definition of Done in CLAUDE.md is met. Flag anything that deserves an ADR.

**Design a new module**
> Read CLAUDE.md, docs/architecture/04-module-system.md and 03-permissions.md. Design the <NAME> module: domain model, permission catalog, events, mobile-first screens, rule-pack touchpoints. Write docs/architecture/modules/<name>.md, add its phase to ROADMAP.md, and stub its manual chapter.

**Legislation update**
> Read docs/architecture/06-ai-platform.md. For country <XX>: research <topic> legislation, draft a rule-pack update with citations and effective dates as a proposal (status: draft), and list exactly what a human must verify before approving it.

**Docs health check**
> Audit docs/manual/ and ROADMAP.md against the actual code. List drift — features without manual pages, stale pages, done-but-unticked items — then fix it.
