# Processing register (RGPD art. 30)

> **Status**: Phase 0 baseline — reflects what the platform actually processes today.
> Every phase that adds personal data MUST update this register in the same PR
> (Definition of Done). Controller: **Sorusoft** (product: Soru).

## Processing activities

| # | Activity | Data subjects | Personal data | Purpose | Legal basis | Retention |
|---|---|---|---|---|---|---|
| 1 | Account & authentication | All users | Email, password hash, TOTP factor secrets, display name, avatar URL, locale/theme prefs, session tokens, IPs (auth logs) | Sign-in with mandatory 2FA; account self-service | Contract (ToS) | Account lifetime; auth logs per Supabase defaults |
| 2 | Company membership & invitations | Users, invitees | Invited email address, inviter identity, membership status, join timestamps | Multi-company tenancy; invitations (14-day expiry) | Contract; legitimate interest (invitee, until accepted/expired) | Membership lifetime; expired/revoked invitations deleted |
| 3 | Error monitoring (when DSN enabled) | All users | Error context (may include user id, URL) | Reliability | Legitimate interest | Sentry retention window |
| 4 | Web analytics | Visitors | Anonymized page metrics (Vercel Analytics, cookieless) | Product improvement | Legitimate interest | Vercel retention window |

Future modules (HR: contracts/salaries; Finance: invoices/expenses) register their
activities when they ship — HR data is **special-category adjacent** (payroll) and gets
field-level sensitivity treatment ([03-permissions.md](../03-permissions.md)).

## Processors (DPAs required before real-customer data)

| Processor | Role | Location | Data |
|---|---|---|---|
| Supabase | Database, auth, storage | EU (`eu-central-1`, Frankfurt) | All application data |
| Vercel | App hosting, analytics | EU edge (functions: `iad1` default — **move to EU region before launch**, ROADMAP follow-up) | Request data in transit |
| GitHub | Source code, CI | US | No personal data (code only; secrets encrypted) |
| Sentry (pending) | Error monitoring | Choose EU region at project creation | Error context |
| Anthropic (Phase 5) | AI processing | US (zero-retention API tier to be confirmed) | Prompt content under AI gateway rules ([06](../06-ai-platform.md)) |

## Data subject rights

- **Access/export & erasure**: manual on request in Phase 0 (contact founder); automated
  DSR jobs are a Phase 7 roadmap item. Erasure = anonymization where legal retention
  applies (invoices etc. — see [07](../07-security-compliance.md)).
- **Rectification**: self-service (profile) or company admin (memberships).

## Register maintenance

Owner: founders. Review at every phase close + the Phase 7 GDPR pass. Changes via PR —
history is the audit trail.
