# 07 — Security & compliance

Security posture in one line: **the database is the boundary** (RLS + `authorize()` + mandatory 2FA), everything is audited, AI never exceeds the asking user, and country compliance is versioned data (rule packs), not code.

## Threat model (top risks → controls)

| # | Threat | Primary controls |
|---|---|---|
| 1 | **Cross-tenant leak** (bug exposes company B to company A) | RLS on every tenant table via `authorize()`; `security_invoker` reporting views; CI leak-test suite (below); storage paths company-scoped |
| 2 | **Privilege escalation inside a company** | Role management itself permissioned; can't grant what you don't hold; last-Owner protection; permission changes audited + alerting (Security module) |
| 3 | **Account takeover** | Mandatory TOTP 2FA (AAL2 enforced in `authorize()`); session revocation in profile; sign-in anomaly detection (below) |
| 4 | **AI prompt injection / data exfiltration via AI** | Tools run as the user (RLS bites); no raw-SQL tool; per-surface tool allowlists; retrieved docs treated as untrusted data; outputs are proposals needing human approval; per-company budgets + kill-switch |
| 5 | **Malicious insider with legitimate access** | Least-privilege templates; field-splitting for sensitive data; append-only audit; mass-export and unusual-access detections (Security module) |
| 6 | **Supply chain / secrets** | Lockfiles + Dependabot + CI audit; secrets only in Vercel/Supabase env vaults, never in repo; service-role key confined to workers ([05](05-data-platform.md)) |
| 7 | **Platform operator overreach** | App roles have zero tenant-data access by design; future support access = consented, time-boxed break-glass, visible to the company in their audit log |

## RLS testing — the gate that matters

Cross-tenant isolation is proven, not assumed. `supabase/tests/` holds a fixture with two companies and the persona matrix from [00-overview.md](00-overview.md); for **every tenant table** the suite asserts, per persona:

1. cannot read/write the *other company's* rows (the leak test);
2. scope semantics: `own` sees self only, `team` sees own team only, `company` sees all — including the worked examples from [03-permissions.md](03-permissions.md);
3. an `aal1` (no-2FA) session reads nothing;
4. a table with RLS disabled or no policy fails a schema lint check.

CI runs this on every PR ([01-tech-stack.md](01-tech-stack.md)). A migration adding a tenant table without matching tests does not merge.

## Security module (`security`) — for the company's security team

Requested as a first-class module: per-company **intrusion detection and security operations**, enabled like any module, with its own catalog (`security.*` permissions → a "Security Officer" role template). It consumes streams the platform already produces — audit log, auth events, `ai_actions`, permission changes, export activity — so its cost is mostly UI + detection rules.

**Signals collected (platform level, always on):**

```sql
create table security_events (
  id          bigint generated always as identity primary key,
  company_id  uuid,                    -- null = platform-scope event
  user_id     uuid,
  kind        text not null,           -- 'auth.login_failed', 'auth.mfa_failed', 'auth.new_device',
                                       -- 'authz.denied_spike', 'data.mass_export', 'perm.role_changed',
                                       -- 'perm.delegation_created', 'ai.budget_spike', 'session.impossible_travel'
  severity    text not null,           -- info | warning | critical
  context     jsonb not null,          -- ip, user_agent, counts, entity refs
  created_at  timestamptz not null default now()
);
```

Producers: auth hooks (failed logins, MFA failures, new device/location), `authorize()` denial counters (a user hammering permissions they don't have), export endpoints (row counts), role/membership triggers, AI usage meter.

**Detections (v1 = rule-based, evaluated by a scheduled job; AI-assisted later):**
- brute force / credential stuffing (failed-login velocity per account and per IP);
- impossible travel & new-device sign-ins;
- permission-denial spikes (probing);
- mass export / unusual data volume for that user's baseline;
- privilege changes outside business hours; dormant account suddenly active;
- AI budget/usage anomalies.

**Security team screens** (`/c/[slug]/security`, mobile-first like everything):
- **Overview** — open alerts by severity, sign-in map, posture score;
- **Alerts** — triage list → detail (timeline of related events) → acknowledge/resolve with notes (the approval + audit primitives give this for free);
- **Audit explorer** — filterable audit log + auth events for their company;
- **Posture** — stale invitations, unused roles, over-privileged members (permissions granted vs used), segregation-of-duties warnings, delegation inventory;
- **Policies** — alert thresholds, notification routing (e.g. critical → all Security Officers).

**Permissions**: `security.alert.read/triage`, `security.audit.read`, `security.posture.read`, `security.policy.manage` — so a company can have a security team with **no access to business data** (they see *that* salaries were exported, not the salaries).

AI assist (later): natural-language triage ("summarize this alert and related activity"), anomaly-detection models over baselines — same guardrails as every AI surface.

Platform-scope twin: the same `security_events` stream with `company_id null` feeds *our* operations (Sentry alerts, dashboards) — one pipeline, two audiences.

## Secrets & keys

- Browser gets only the anon key (RLS makes it safe by construction).
- Service-role key: outbox/job workers only; never in Next.js request paths, never in AI tools.
- Claude API key, SMTP, etc.: Vercel/Supabase env vaults; no secrets in the repo (gitleaks in CI); quarterly rotation checklist.

## GDPR (launch requirement, not later)

- **EU region** for all Supabase data; Vercel EU function regions preferred.
- **Data-subject rights**: per-person export (JSON+CSV of everything keyed to them) and **erasure = anonymization** — personal columns overwritten, business/accounting records preserved (legal retention beats erasure for invoices; the processing register documents this) — both as platform jobs with identity verification + audit.
- **Processing register** maintained in `docs/architecture/compliance/processing-register.md` (created with Phase 0); DPAs: Supabase, Vercel, Anthropic.
- **Retention**: per-table policy ([05](05-data-platform.md)); payroll/accounting per PT statutory minimums (10 years for accounting docs).
- AI note: no training on customer data (API defaults), providers listed in the register, PII sent to models minimized to the task.

## Portugal compliance pack (worked example for "country as data")

What the PT rule packs + Finance/HR modules must cover — each item is roadmap-tracked, values live in `rule_packs` with citations ([06](06-ai-platform.md)):

| Area | Requirement |
|---|---|
| Invoicing | **ATCUD** + QR code on invoices; sequential certified series; **SAF-T (PT)** monthly/annual export |
| ⚠️ Certification | Invoicing software must be **AT-certified (Portaria 363/2010)** before issuing legal invoices for third parties. Until certified, the demo issues internal/pro-forma documents and says so on-screen. This is the honest gate for Finance go-live in PT. |
| Payroll | IRS withholding tables (yearly), **TSU** 23.75%/11%, meal-allowance exemption limits, holiday & Christmas subsidies, **DMR** monthly declaration |
| Leave | 22 working days minimum, public holidays (national + municipal), parental leave rules |
| Reporting | Relatório Único, SAF-T accounting variant (parking lot until accounting module) |

## Backups & incident response

- Supabase PITR + weekly logical dumps to Storage per environment; restore drill once per quarter (staging).
- Per-company logical export doubles as enterprise off-boarding and the [ADR-0002](adr/ADR-0002-tenancy-model.md) escape hatch.
- Incident runbook (`docs/architecture/compliance/incident-runbook.md`, Phase 0): triage → contain (kill-switches: AI per company, module disable, session revocation) → assess scope via audit/security_events → notify (GDPR 72h clock) → post-mortem ADR.
