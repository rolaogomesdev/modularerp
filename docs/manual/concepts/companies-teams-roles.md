---
title: "Companies, teams & roles: how access works"
audience: [member, team-manager, company-admin, platform-admin]
module: platform
feature: permissions
permissions: []
path: Settings → Teams / Settings → Roles
countries: [all]
status: planned
locale: en
updated: 2026-07-06
---

# Companies, teams & roles — how access works

Everything you can see and do in Soru follows four simple ideas.

## 1. Companies

A **company** is a sealed space: its people, documents and numbers are invisible to every other company. Your account can belong to several companies (a common thing for accountants, for example) — you switch from the company name at the top, and each company only ever sees its own side of you.

## 2. Teams

A **team** is a group of people who work together: "Contabilidade", "Produção — Turno A", "Loja do Porto". Teams do two jobs: they mirror how your company is organized, and they set the *reach* of managers' powers.

## 3. Roles

A **role** is a named bundle of permissions: *HR Manager* can manage contracts and absences; *Accountant* can handle invoices and expenses; *Employee* can request absences and see their own payslips. Companies start with ready-made role templates and can copy or build their own from the full permission catalog.

## 4. You get a role *within* a team

Access is always **person + team + role**. Marta is *HR Manager* in the whole company; João is *Supervisor* **of Team A** — his approval powers stop at Team A's border. If you belong to several teams with different roles, you have the combination of all of them.

Each permission inside a role has a **reach**:

| Reach | Means | Example |
|---|---|---|
| **own** | only things about you | see *your* payslips |
| **team** | things in the team where you hold the role | approve *your team's* absences |
| **company** | everything in the company | see all invoices |

## What this looks like day to day

- You only see modules, menus and buttons you have permission for. Nothing you can't use is shown.
- When something is off-limits, the app names the missing permission — "You need *Approve absences* (`hr.absence.approve`) — ask your administrator" — so the conversation with your admin is easy.
- Especially private data (like salaries) is locked behind its own dedicated permission, marked ⚠ in the role editor, so it is never included by accident.
- Every change to roles, teams and memberships is recorded in the company audit trail.
- These rules are enforced in the database itself — the same rules apply to the app, to exports, and to the AI assistant, which can never see more than *you* can.

## For admins: three rules of thumb

1. **Model teams after reality** — the org chart you actually run, not the ideal one.
2. **Start from templates, subtract later** — copy *Supervisor*, remove what your supervisors shouldn't do.
3. **Prefer team reach** — give *company* reach only to genuinely company-wide roles. You can always widen later; narrowing is the painful direction.
