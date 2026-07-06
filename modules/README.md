# modules/

One folder per business module (HR, Finance, Production, …), following the contract in
[docs/architecture/04-module-system.md](../docs/architecture/04-module-system.md):

```
modules/<key>/
  module.ts        ModuleDefinition (single source of truth)
  ui/              screens — only packages/ui components
  server/          server actions & queries (zod-validated)
  domain/          pure business logic (no IO)
  events.ts        publishes/subscribes
  permissions.ts   PermissionSeed list
  manual/          mirrored into docs/manual/modules/<key>
```

Modules never import each other's internals — integration is via the event outbox and each
module's `public.ts`. The first module (HR) lands in Phase 3.
