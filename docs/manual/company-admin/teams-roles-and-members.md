---
title: Teams, roles & member access
audience: [company-admin]
module: platform
feature: permissions
permissions: [platform.team.manage, platform.member.manage, platform.role.manage]
path: /c/[company] → Settings
countries: [all]
status: live
locale: en
updated: 2026-07-08
---

# Teams, roles & member access

## How access works

**Teams** group people (e.g. *Shift A — Factory 1*). **Roles** describe what someone may do (e.g. *Supervisor*). A person never holds a role on its own — they hold it **within a team**, and each ability in a role carries a **scope**: **Own** (only things about me), **Team** (things belonging to my team) or **Company** (everything). Example: a Supervisor of *Shift A* with *approve absences* at scope **Team** can approve absence requests from Shift A colleagues — but not their own requests, and not those of Shift B. Someone in several teams simply combines the abilities of all their assignments.

## Create a team

**Navigation: `/c/[company]` → *Settings* → *Teams* → *New team***

1. Enter the **team name** — pick names your colleagues recognise (departments, shifts, sites).
2. Optionally choose a **parent team** to reflect your organisation chart. This is for orientation only: abilities granted on a parent team do **not** automatically extend to its sub-teams.
3. Press **Create team**. It appears in the list immediately; open it to see and manage its members.

## Assign a role

**Navigation: `/c/[company]` → *Settings* → *Members* → choose the person → *Assign a role***

1. Pick the **team** and the **role** the person should hold in it.
2. Optionally set an **end date**. The assignment then expires automatically at that moment — no reminder needed, no clean-up to forget. Use this for temporary cover, e.g. *"João approves absences for Shift A while Marta is on holiday until the 24th."*
3. Confirm. The new abilities apply **immediately** — the person does not need to sign out and back in.

A person can hold different roles in different teams (Supervisor in one, plain Employee in another); their access is the combination of all of them.

> You can only hand out abilities you hold yourself — the app will not let anyone use role assignment to gain more power than they have.

## Suspend & reactivate a member

**Navigation: `/c/[company]` → *Settings* → *Members* → choose the person → *Suspend***

Suspending a member cuts their access to the company **instantly** — every screen, list and report becomes unavailable to them, including anything already open on their phone. Nothing is deleted: their records, history and role assignments stay exactly as they were. Press **Reactivate** and everything works again as before.

Use suspension when someone leaves, loses a device, or you need to pause access while something is investigated. It is always safe — it is a switch, not an eraser.

## Edit what a role can do

**Navigation: `/c/[company]` → *Settings* → *Roles* → choose the role**

You see the role's abilities grouped by area (Platform, HR, Finance, …). For each ability you can:

- turn it **on or off**;
- choose its **scope**:
  - **Own** — only items about the person themselves (their own requests, their own payslip);
  - **Team** — items belonging to the team where the person holds this role;
  - **Company** — every item in the company, regardless of team.

Some abilities are marked as **sensitive** (for example anything touching salaries). Granting these asks for an extra confirmation — take a moment to check who will end up with the role before you confirm.

Changes to a role apply to **everyone who holds it**, in every team, immediately.

## The standard roles

Five roles come pre-created with every company: **Owner**, **HR Manager**, **Accountant**, **Supervisor** and **Employee**. They are sensible starting points — you can adjust them or build your own roles from scratch. As the HR, Finance and Production modules arrive, their abilities appear automatically in the role editor, ready to grant.

One guard rail: the company can never lose its last **Owner** — the app refuses to remove or suspend them until another Owner exists.

## Rules that protect you

- **Everything is recorded.** Every change to teams, roles and assignments lands in the audit trail — who changed what, when, and how it looked before.
- **Companies are sealed off.** You can never see or edit another company's teams, roles or members — and no one outside your company can see yours.
- **Changes act immediately.** Granting, removing, suspending: all take effect the moment you confirm, on every device.
