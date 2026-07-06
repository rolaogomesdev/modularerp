# 04 — Module system

A **module** is a self-contained business capability (HR, Finance, Production, Training…) that plugs into the platform core. The core provides identity, permissions, primitives, design system and AI; modules provide domain tables, screens, events and manual chapters. Adding a module must never require editing the core.

## The registry

Static, typed, compile-time (no dynamic plugin loading in v1 — simplicity and typesafety win; ADR if marketplace-style loading is ever needed):

```ts
// modules/registry.ts
import { hr } from '@/modules/hr/module';
import { finance } from '@/modules/finance/module';
export const modules: ModuleDefinition[] = [hr, finance /* , production, training */];
```

```ts
// packages/module-kit/types.ts
export interface ModuleDefinition {
  key: ModuleKey;                       // 'hr' — table prefix, URL segment, permission prefix
  name: LocalizedString;                // nav label (pt-PT, en)
  icon: IconName;                       // from packages/ui icon set
  nav: NavItem[];                       // shell entries, each gated by a permission
  routes: () => RouteEntry[];           // registered under /c/[company]/<key>/...
  permissions: PermissionSeed[];        // seeded into the catalog (03-permissions.md)
  roleTemplateGrants: TemplateGrant[];  // what Owner/Supervisor/… templates get from this module
  events: {
    publishes: EventName[];             // 'hr.employee.hired'
    subscribes: EventHandlerRegistration[];
  };
  jobs: JobRegistration[];              // scheduled work (05-data-platform.md)
  rulePackNamespaces: string[];         // legislation it reads, e.g. 'payroll', 'leave'
  aiTools?: AiToolRegistration[];       // module copilot tools (06-ai-platform.md)
  searchables?: SearchableRegistration[]; // global search entries
  manualChapter: string;                // 'docs/manual/modules/hr' — must exist (CI-checked)
}
```

## Module folder contract

```
modules/hr/
  module.ts        the ModuleDefinition (single source of truth)
  ui/              screens & components — ONLY packages/ui components, no raw styling
  server/          server actions, queries (all zod-validated)
  domain/          pure business logic (no IO — unit-testable)
  events.ts        publishes/subscribes
  permissions.ts   PermissionSeed list
  manual/          → symlinked/mirrored into docs/manual/modules/hr
```

Migrations live in `supabase/migrations/` prefixed `NNNN_hr_*.sql` — one migration stream for the whole database (single shared schema, [ADR-0002](adr/ADR-0002-tenancy-model.md)), prefixes only for readability. Module tables are prefixed `hr_`, `finance_`, …

## Hard boundaries

1. **No cross-module imports of internals.** `modules/finance` never imports from `modules/hr/…`. Integration happens via:
   - **Events** through the outbox (`hr.employee.hired` → Finance creates a payroll cost center) — [05-data-platform.md](05-data-platform.md);
   - **Public contracts**: a small `modules/<key>/public.ts` exporting stable read APIs/types other modules may use (lint-enforced import boundary).
2. **No module touches another module's tables** — not even read-only SQL joins in code. Cross-module reporting uses reporting views owned by the source module (`rpt_hr_headcount`, [05](05-data-platform.md)).
3. **No country logic in modules.** Anything legal reads the active rule pack ([06-ai-platform.md](06-ai-platform.md)).
4. **UI only from the design system** ([09-design-system.md](09-design-system.md)).

## Per-company enablement

```sql
create table company_modules (
  company_id  uuid not null references companies(id),
  module_key  text not null,
  enabled     boolean not null default false,
  settings    jsonb not null default '{}',
  enabled_at  timestamptz,
  primary key (company_id, module_key)
);
```

- Nav hides disabled modules; routes return 404; the module's permissions stop resolving (checked inside `authorize()` pre-filter or by nav/route guards — data stays intact).
- Disabling never deletes data; re-enabling restores everything.
- Enablement UI: `/c/[slug]/settings/modules` (`platform.module.manage`, Owner template).

## What registration wires up (deploy-time & runtime)

| Declaration | Effect |
|---|---|
| `permissions` | Idempotent catalog seed on migrate; new keys appear in the roles matrix UI automatically |
| `roleTemplateGrants` | Extends shipped templates (existing customized roles are untouched — admins opt in) |
| `nav`/`routes` | Shell renders permission-gated entries; router mounts under `/c/[company]/<key>` |
| `events.subscribes` | Outbox dispatcher routes events to handlers |
| `jobs` | Registered with the scheduler |
| `rulePackNamespaces` | Onboarding wizard + compliance screens know what the module needs |
| `aiTools` | Module copilot tools appear in the AI gateway allowlist |
| `manualChapter` | CI fails if the chapter folder is missing or stubless at "live" status |

## Versioning & compatibility

- The app deploys as one unit — modules version with the app; no independent module releases in v1.
- **Events are contracts**: payloads are zod-versioned (`hr.employee.hired.v1`); breaking change ⇒ new version published alongside, consumers migrate, old one retired via roadmap item.
- **Reporting views are contracts**: additive changes only; renames require a deprecation window.

## Definition of Done for a new module (CI + review checklist)

- [ ] `module.ts` complete; registered in `modules/registry.ts`
- [ ] Migrations follow [05-data-platform.md](05-data-platform.md) conventions; RLS policies + RLS tests for every table
- [ ] Permission seeds + template grants; roles matrix renders them
- [ ] Events documented in the module README; zod schemas exported from `public.ts`
- [ ] Screens pass the design-system checklist at 390 px, light + dark
- [ ] Manual chapter written for every affected audience, front-matter complete
- [ ] `ROADMAP.md` updated
