# ADR-0004 — Distribution model: sales-led, invitation-only

- **Status**: accepted
- **Date**: 2026-07-10
- **Amends**: the open-signup flows in [02-tenancy-and-identity.md](../02-tenancy-and-identity.md)

## Context

Soru launches sales-led: customers discover the product through the Sorusoft
website (sorusoft.pt / .com / .net — domains to be acquired) and demos, buy a
set of modules, and receive **personalized onboarding** — Sorusoft configures
the company, its structure and its modules to the customer's needs. Anonymous
self-serve signup does not fit this motion and invites junk tenants.

## Decision

1. **Company creation is platform-admin only.** `create_company` requires
   `profiles.app_role = 'platform_admin'`. Regular users cannot found companies.
2. **Provisioning flow**: a platform admin (at `/admin`) creates the customer
   company and issues an **owner invitation** to the customer's email. The
   customer creates their account through that invitation, enrolls 2FA, accepts
   — and lands as the company's **Owner** (role assigned on accept via
   `invited_role_template`).
3. **Signup is invitation-only.** Account creation is rejected unless a pending
   invitation exists for the email (enforced at the auth layer via the
   before-user-created hook; the signup UI says so politely and points to the
   website). Existing-account invitees are unaffected.
4. **Module entitlements** ("the modules the customer paid for") are enabled
   per company by platform admins — UI arrives with `company_modules` and the
   module registry (Phase 3); the `/admin` area is its natural home.
5. **The two-layer rule is untouched**: platform admins provision companies as
   objects but still read zero business data (RLS unchanged, provable).

## Consequences

- The home screen's "create a company" form is platform-admin-only; company-less
  users see their pending invitations and a pointer to Sorusoft.
- `/admin` (platform area) gains its first real function: company list +
  provisioning. Platform admins get a companies **metadata** read policy
  (name/slug/created — never member/business rows beyond what RLS grants).
- Self-serve remains one migration away if the strategy ever calls for it
  (product-led motions, free trials): the gate is a check inside one RPC and
  one auth hook — nothing structural. This ADR flips a switch, not the
  architecture.
- The marketing website (sorusoft.pt) is a separate deliverable; the app is
  expected to move to a subdomain (e.g. app.sorusoft.pt) once domains exist —
  Vercel domain config + Supabase Site URL updates tracked in ROADMAP.
- `app_role = 'platform_admin'` is granted only via direct database operation
  by the operators (never through the app; self-escalation already test-blocked).
