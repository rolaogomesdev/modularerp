# ADR-0001 — Founding decisions

- **Status**: Accepted
- **Date**: 2026-07-06
- **Deciders**: Product owner (Ruben), Claude (founding architect)

## Context

We are starting a mobile-first, AI-native, modular ERP. Before writing the architecture we fixed the decisions that everything else hangs on. These were confirmed by the product owner in the kickoff conversation.

## Decisions

### 1. Product name: "Modular ERP" (working title)

A real name comes later. Consequence: the name must never be baked into identifiers, database schemas, package names, URLs or environment variables. Code uses neutral identifiers (`app`, `erp-core`); the display name lives in one i18n string.

### 2. Launch market: Portugal (PT primary, EN secondary)

The first country pack, legislation corpus, and compliance work target Portugal. English is the second locale and the authoring language for docs. Adding a country must never require touching module code — only a country **rule pack** (legislation as data) and a **locale pack** (translations). See [06-ai-platform.md](../06-ai-platform.md) and [07-security-compliance.md](../07-security-compliance.md).

### 3. Module order: HR → Finance → Production, then Training

HR ships first because every other module references people, teams and roles, and because HR exercises the permission system hardest (salaries → field-level sensitivity; absences → approval workflows). Training (courses, certifications, mandatory training) follows as an HR-family module reusing HR records. Inventory, Sales/CRM, Procurement and Projects stay in the roadmap parking lot.

### 4. Auth: Supabase email/password + mandatory TOTP 2FA; per-company SSO later

Demo auth is Supabase email/password with **2FA (TOTP) enforced for every user** — sessions must reach AAL2 before touching company data. The architecture reserves a per-company SSO upgrade (Active Directory / Microsoft Entra ID, Google Workspace, Microsoft accounts) via per-company IdP configuration and domain-routed sign-in. 2FA remains enforced regardless of provider. Identity provider changes must never touch the permission model.

### 5. Personal profile is global; employee record is per-company

Every user owns one account-level profile (avatar, display name, locale, theme, notification preferences, security self-service). HR owns a separate per-company employee record. Leaving a company never deletes the account; HR data never crosses companies.

### 6. Themes: light + dark from day 1

All colors flow through design tokens; dark mode is a second token set, not a retrofit. Default follows the device; per-user override lives in the personal profile. Rationale: retrofitting is expensive, and Production users work in low-light environments.

### 7. Demo infrastructure: GitHub + Vercel + Supabase (EU region)

Next.js App Router + TypeScript on Vercel; Postgres, Auth, Storage, Realtime, Edge Functions and pgvector on Supabase. All data hosted in an EU region for GDPR. This is a demo-cost stack chosen so that nothing in the architecture blocks moving to dedicated infrastructure later.

## Consequences

- The kickoff architecture (docs `00`–`09`) treats these as fixed constraints.
- Revisiting any of them requires a superseding ADR that names this one.
