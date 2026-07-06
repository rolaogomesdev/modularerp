# User manual — rules of the house

This folder is the **user manual** for Modular ERP and the **knowledge base of the in-app AI help assistant**. It is served in-app at `/help`, filtered by audience. It is written for users — no developer jargon, no internal codenames.

## Structure

```
member/           people using the app day-to-day
team-manager/     people who approve and oversee a team
company-admin/    people who configure their company (owners, admins)
platform-admin/   people who operate the platform itself
concepts/         shared explanations (companies, teams, roles, profile)
modules/<key>/    per-module chapters (hr, finance, production, security, training)
```

## Front-matter — mandatory on every page

```yaml
---
title: Approve an absence request
audience: [team-manager]            # member | team-manager | company-admin | platform-admin
module: hr                          # platform for core features
feature: absences
permissions: [hr.absence.approve]   # what the reader needs to hold; [] if none
path: Approvals → Absences          # EXACT in-app navigation, → separated
countries: [all]                    # or [PT] for country-specific pages
status: planned                     # planned → draft → live → outdated
locale: en
updated: 2026-07-06
---
```

This metadata is not decoration — the AI assistant **retrieves by it** (audience + permissions filtering) and **navigates by it** (`path` becomes tappable deep links). A wrong `path` sends users to the wrong screen; a missing `permissions` list makes the assistant leak admin instructions to members.

## Writing rules

1. **Every how-to opens with Where and Needs**:
   > **Where**: Approvals → Absences
   > **Needs**: permission *Approve absences* (`hr.absence.approve`)
2. Steps are numbered, one action per step, phone-first (say "tap", mention the bottom tabs).
3. Name permissions in plain language first, key in parentheses — same wording the app's error messages use.
4. Screenshots optional until `live`; when added, both themes not required — light only, mobile frame.
5. **Status lifecycle**: `planned` (feature not built — page may sketch the intent) → `draft` (feature exists, page unverified) → `live` (verified against the real UI at phase exit) → `outdated` (drift detected — fix or demote). The assistant only answers from `draft`+`live` pages and warns on `draft`.
6. A feature PR that changes UI **must** update the affected pages in the same PR (CLAUDE.md Definition of Done). The "Docs health check" prompt in [PROMPT.md](../../PROMPT.md) audits drift.
7. **Language**: authored in English (`locale: en`); the pt-PT pass happens in roadmap Phase 7 as sibling files (`*.pt-PT.md`). PT is the launch language — after Phase 7, changing a page means changing both locales in the same PR.
