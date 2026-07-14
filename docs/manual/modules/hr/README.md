---
title: HR module
audience: [member, team-manager, company-admin]
module: hr
feature: overview
permissions: [hr.absence.create, hr.absence.read, hr.absence.approve]
path: Company → Leave requests
countries: [all]
status: live
locale: en
updated: 2026-07-14
---

# HR

People, contracts and absences: employee records, the team directory, absence requests and approvals, vacation balances (with your country's legal defaults applied automatically), and — for those with the dedicated permission — salary information.

## Available now — Leave requests

The first HR feature: request time off, route it for approval, and track the decision. It composes the platform primitives (approvals, notifications, audit, events) and shows any **custom fields** your admin added for absences.

### Request leave (member)

**Navigation: `/c/[company]` → *Leave requests* → *New request***

**Permission:** `hr.absence.create` (the *Employee* role template has it at *own* scope — you can request for yourself).

1. Pick the **type** (vacation, sick, personal, other), the **start** and **end** dates, and optionally a short **reason**.
2. Fill in any extra fields your company added — these come from *Settings → Custom fields* (entity *Absences*) and appear here automatically.
3. Press **Submit request**. It goes to an approver; you'll get a notification when it's decided, and you can follow its status under *Leave requests*.

You can't approve your own request — that always takes a second person (four-eyes).

### Approve or reject (team-manager)

**Navigation: `/c/[company]` → *Approvals***

**Permission:** `hr.absence.approve` (*Supervisor* at team scope, *HR Manager* / *Owner* at company scope).

Pending leave requests you may decide appear in your **Approvals** inbox alongside every other approval. Open one, optionally add a note, and **Approve** or **Reject** — the requester is notified and the decision is recorded in the audit trail.

### Export

**Navigation: `/c/[company]` → *Leave requests* → *Export CSV***

Downloads the requests you can see as a CSV — including a column for every custom absence field. Portuguese accents render correctly; the export is recorded like every other action.

---

*The rest of the HR module ships in roadmap Phase 3. Planned pages:*

- My data: what HR keeps about you (member)
- Manage employees & contracts (company-admin)
- Vacation balances & country leave rules (company-admin)
- Salary access: the ⚠ permission explained (company-admin)
