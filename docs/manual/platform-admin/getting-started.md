---
title: Getting started as a platform admin
audience: [platform-admin]
module: platform
feature: onboarding
permissions: []
path: Admin
countries: [all]
status: planned
locale: en
updated: 2026-07-06
---

# Getting started as a platform admin

You operate the platform that hosts every company. Your app role (`platform_admin`) is deliberately narrow: you manage **companies as objects** — you can never open their business data. That separation is by design and enforced in the database, not by good intentions.

## Where you work

> **Where**: Admin (visible only to platform admins)
> **Needs**: app role `platform_admin`

- **Companies** — list, create, suspend; country, plan and module availability per company.
- **Health** — background jobs, event queue lag, error rates, AI spend per company.
- **AI controls** — per-company budgets and the emergency kill-switch (disables all AI for a company instantly).

## What you cannot do (and why)

- Read any company's business rows — employees, invoices, documents. Database policies exclude app roles entirely.
- Act inside a company. If support requires it one day, it will be a **break-glass** feature: time-boxed, requiring the company admin's consent, and visible to the company in their own audit log. Until that feature exists, there is no path.

## Your responsibilities

1. Keep the platform healthy (dead-letter queue empty, restore drills on schedule).
2. Respond to security alerts on the platform stream (see the incident runbook).
3. Manage the demo/sandbox tenants.
4. Never ask users for passwords or verification codes — support flows must not train users to share secrets.
