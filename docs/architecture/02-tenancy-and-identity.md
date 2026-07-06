# 02 — Tenancy & identity

One deployment hosts many companies in **one database with row-level isolation** (`company_id` + RLS on every tenant table — decided in [ADR-0002](adr/ADR-0002-tenancy-model.md)). One person = one account, member of any number of companies.

## Core tables (sketch — refined in Phase 0/1 migrations)

```sql
-- 1:1 with auth.users (created by trigger on signup)
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  avatar_url    text,
  locale        text not null default 'pt-PT',          -- 'pt-PT' | 'en'
  theme         text not null default 'system',          -- 'system' | 'light' | 'dark'
  notification_prefs jsonb not null default '{}',
  app_role      text not null default 'user',            -- 'user' | 'support' | 'platform_admin'
  created_at    timestamptz not null default now()
);

create table companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,                    -- /c/[slug]/...
  country_code  text not null default 'PT',              -- drives rule packs
  currency      text not null default 'EUR',
  brand         jsonb not null default '{}',             -- logo_url, accent (token-constrained)
  settings      jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- a person's link to a company (NOT the HR employee record)
create table company_members (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id),
  user_id       uuid not null references profiles(id),
  status        text not null default 'invited',         -- 'invited' | 'active' | 'suspended'
  invited_by    uuid references profiles(id),
  invited_email text,                                    -- pre-signup invitations
  joined_at     timestamptz,
  created_at    timestamptz not null default now(),
  unique (company_id, user_id)
);
```

Teams, roles and memberships live in [03-permissions.md](03-permissions.md). Module enablement (`company_modules`) lives in [04-module-system.md](04-module-system.md).

## The two identity layers (never blur them)

| | **App role** (`profiles.app_role`) | **Company roles** (per company) |
|---|---|---|
| Governs | The platform: tenants, plans, support | Business data inside one company |
| Values | `user`, `support`, `platform_admin` | Composed from the permission catalog |
| Access to company data | **None.** `platform_admin` manages companies as objects (create, suspend), never reads their business rows | Everything, as granted |

Support access to a company (debugging) is a later, explicit **break-glass** feature: time-boxed, consented by a company admin, fully audited. Until it exists, support has no path to tenant data.

## Personal profile vs employee record

- **`profiles`** — account-global, owned by the person: display name, avatar, locale, theme, notification prefs, security self-service (password, 2FA devices, active sessions). Editable only by the account owner. Screen: **Profile** (`/me`).
- **`hr_employees`** (HR module, per company) — owned by the company: contract, salary, address for payroll, etc. Created when HR "hires" a member; references `company_members.id`.

Leaving a company deactivates the membership and archives the employee record; the account and its other memberships are untouched. HR data never crosses companies.

## Authentication

**Now (demo):** Supabase Auth email/password with **mandatory TOTP 2FA**.

- Enrollment is forced: after first login, the only reachable screen is 2FA setup until a factor is verified.
- Enforcement is real, not cosmetic: company data requires **AAL2**. Middleware redirects `aal1` sessions to the challenge screen, and the `authorize()` permission function ([03-permissions.md](03-permissions.md)) returns `false` unless the JWT claims `aal = 'aal2'` — so even a crafted API call with a 1-factor session hits closed RLS.
- Recovery codes issued at enrollment; reset via support flow only.

**Later (designed for now):** per-company SSO — Active Directory / Microsoft Entra ID (SAML/OIDC), Google Workspace, Microsoft accounts.

```sql
create table company_sso_connections (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id),
  provider     text not null,            -- 'entra' | 'google' | 'microsoft' | 'saml'
  domains      text[] not null,          -- 'empresa.pt' routes login to this IdP
  config       jsonb not null,           -- provider metadata (no secrets in rows)
  enforced     boolean not null default false,  -- members MUST use SSO
  created_at   timestamptz not null default now()
);
```

Login screen asks for email first; a domain match routes to the company IdP, otherwise password + TOTP. **2FA stays enforced regardless of provider** (IdP MFA satisfies it when the IdP asserts it; otherwise our TOTP challenge still applies). SSO only changes *how a session is created* — membership, teams, roles and RLS are untouched. Directory sync (auto-provision from AD groups → teams) is a parking-lot item.

## Sessions & URL structure

- `@supabase/ssr` cookie sessions; Server Components/Actions get the user's client per request. The user's JWT is what reaches Postgres — RLS always evaluates the real caller, including under AI tools.
- **Active company comes from the URL**: `/c/[companySlug]/hr/absences`. No hidden "current tenant" state; a link is always unambiguous. The shell's company switcher just navigates. Last-used company remembered in a cookie for `/` redirect.
- Non-company routes: `/login`, `/join/[inviteToken]`, `/me` (profile), `/admin` (platform, `platform_admin` only).

## Flows

- **Sign up** → trigger creates `profiles` → forced 2FA enrollment → lands on "create a company or accept an invitation".
- **Create company** → row in `companies` + membership + Owner role assignment ([03](03-permissions.md)) → onboarding wizard applies the country rule pack defaults ([06](06-ai-platform.md)).
- **Invite** → `company_members(status='invited', invited_email)` + emailed token → accept links account (existing or new) → admin assigns team + role. Invitation itself grants **no** permissions.
- **Suspend member** → status flip kills access instantly (memberships stop resolving in `authorize()`); sessions can stay — they just stop passing RLS.

## RLS posture for core tables

- `profiles`: owner reads/updates self; co-members read only safe columns via a `member_directory` view (display_name, avatar) — never prefs or security fields.
- `companies`: members read their companies; only holders of `platform.company.update` (Owner template) update.
- `company_members`: members see the member list of their companies; invite/suspend requires `platform.member.manage`.

Worked examples and the full policy pattern: [03-permissions.md](03-permissions.md).
