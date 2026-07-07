# Incident runbook

> **Status**: Phase 0 baseline. Exercised for real the first time in Phase 7
> (restore drill + pen-test-style RLS probe). Keep this executable — every step
> names a concrete tool that exists today.

## Severity

| Level | Definition | Examples | Clock |
|---|---|---|---|
| SEV-1 | Confirmed data breach or full outage | Tenant data exposed cross-company; DB lost | **RGPD 72h notification clock starts at confirmation** |
| SEV-2 | Security incident, no confirmed exposure | Credential leak, vulnerable dependency in prod, brute-force spike | Same day |
| SEV-3 | Degradation / suspicious signal | Elevated errors, odd audit trail | Next working day |

## 1 · Triage (first 30 minutes)

- Confirm signal source: Vercel logs, Supabase logs (dashboard → Logs), Sentry (when enabled), user report.
- Open an incident note (timestamped log of every action — feeds the post-mortem and any RGPD notification).
- Classify severity; for anything SEV-2+, notify the other founder immediately.

## 2 · Contain (kill-switches available today)

| Switch | How |
|---|---|
| Revoke all sessions of a user | Supabase dashboard → Authentication → user → sign out user |
| Suspend a member's company access | `company_members.status = 'suspended'` (access dies instantly via RLS) |
| Block all traffic | Vercel dashboard → pause deployment / password-protect |
| Rotate credentials | Supabase: DB password + API keys (Settings); GitHub: repo secrets; then redeploy |
| Freeze database writes | Supabase dashboard → pause project (extreme; also stops reads) |

Phase-later switches (AI per-company kill-switch, module disable) are added here when they ship.

## 3 · Assess scope

- `auth.audit_log_entries` (Supabase) — sign-ins, factor changes, token refreshes.
- Application audit log — Phase 1 primitive; until then, table timestamps (`created_at`, `joined_at`) and Postgres logs.
- Vercel request logs for the affected window.
- Key question for RGPD: *which data subjects, which data, exposed to whom, for how long?*

## 4 · Notify

- **RGPD breach (SEV-1)**: CNPD notification within **72h** of awareness (cnpd.pt); affected users "without undue delay" when high risk. Use the incident note as the factual basis.
- Affected companies: honest email from the founders — what happened, what we did, what they should do.
- No public statement before facts are established; never speculate in writing.

## 5 · Post-mortem (within one week)

- Blameless write-up as an **ADR** in `docs/architecture/adr/` (what happened, timeline, root cause, corrective actions with roadmap items).
- Every corrective action lands in `ROADMAP.md` — an unfixed root cause is an open incident.

## Contacts

| Role | Who |
|---|---|
| Incident lead | Rúben (founder) |
| Second | Sofia (founder) |
| Supabase support | dashboard → Support (include project ref) |
| Vercel support | vercel.com/help |
| CNPD (PT DPA) | geral@cnpd.pt · +351 213 928 400 |
