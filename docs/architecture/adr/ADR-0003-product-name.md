# ADR-0003 — Product name: Soru (by Sorusoft)

- **Status**: accepted
- **Date**: 2026-07-07
- **Amends**: ADR-0001 decision 1 (working title "Modular ERP")

## Context

ADR-0001 deliberately shipped with a working title and a rule: renaming must stay cheap — the name never lands in identifiers, schemas, package names or URLs. The founders have now chosen the real names: the company is **Sorusoft** (from the founders' names, Sofia + Rúben, + "soft"), and the product needed its own name.

## Decision

- **Product name: "Soru"** — derived from the company name; short, pronounceable in Portuguese and English, and keeps all brand equity in one family ("Soru by Sorusoft").
- **Company: Sorusoft** — appears as the credit line ("by Sorusoft") where appropriate, and as the legal entity.
- The ADR-0001 rule **survives unchanged**: "Soru" appears only in user-facing strings (i18n catalogs), documentation prose and marketing surfaces. Identifiers stay neutral (`@repo/*` packages, `erp` local project id, table names, permission keys, event names, URLs).

## Consequences

- Rename executed by changing: i18n `app.title`, documentation/manual prose, and this ADR trail. No code identifiers changed — the rule proved itself.
- Domain and trademark checks (`.pt`/`.com`/`.app`, EUIPO class 42) are the founders' follow-up before public launch; if a conflict forces another rename, the cost stays the same small set of strings.
- The GitHub repository (`modularerp`) and local folder name may be renamed at the founders' convenience; nothing in code references them.
