---
title: Getting started as a company admin
audience: [company-admin]
module: platform
feature: onboarding
permissions: [platform.member.manage, platform.role.manage, platform.module.manage]
path: Settings
countries: [all]
status: planned
locale: en
updated: 2026-07-06
---

# Getting started as a company admin

You set your company up and decide who can do what. This guide covers the first hour: create the company, shape teams and roles, invite people, enable modules.

## 1. Create your company

After creating your account (see [member getting started](../member/getting-started.md) for sign-up and two-step verification):

1. Choose **Create a company**.
2. Enter name and country. **Country matters**: it selects the legal defaults the app applies (vacation rules, tax values…) — for Portugal these come pre-configured.
3. The setup wizard walks you through the rest; you become the **Owner** with all permissions.

## 2. Understand teams, roles and permissions (5 minutes well spent)

Read [Companies, teams & roles](../concepts/companies-teams-roles.md). The short version:

- **Teams** group people (e.g. "Produção — Turno A").
- **Roles** are named sets of permissions (e.g. *HR Manager*). We ship ready-made templates you can use as-is or copy and adjust.
- People get **a role within a team**. A Supervisor of Team A has power in Team A only.
- Each permission in a role has a **reach**: *own* (themselves), *team*, or *company*.

## 3. Set up your structure

> **Where**: Settings → Teams / Settings → Roles
> **Needs**: *Manage roles* (`platform.role.manage`)

1. Create your teams first — mirror how the company actually works.
2. Review the role templates (Owner, HR Manager, Accountant, Supervisor, Employee). Copy and adjust rather than starting from zero.
3. Sensitive permissions (like *View salaries*) are flagged ⚠ and asked to confirm — grant them deliberately.

## 4. Invite people

> **Where**: Settings → Members
> **Needs**: *Manage members* (`platform.member.manage`)

1. **Invite** → email → choose team + role.
2. The invitation itself gives no access; permissions apply once they join with the role you set.
3. Someone leaves? **Suspend** cuts access immediately; their records stay for your books.

## 5. Enable modules & make it yours

> **Where**: Settings → Modules / Settings → Branding

- Turn on the modules you need (HR first — the others build on it). Disabling later hides but never deletes data.
- Upload your logo and pick an accent color — the app checks it stays readable in light and dark themes.
- Add **custom fields** to records you need more from (Settings → Custom fields), no developer required.

## 6. Know your safety nets

- **Audit**: every important change (who, what, when, before/after) is recorded — Settings → Audit.
- **Approvals**: money- and people-affecting actions go through approval flows; nobody can approve their own request.
- **The assistant** answers admins' questions too: *"how do I give someone access to expenses only?"*
