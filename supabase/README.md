# supabase/

Migrations, seed data, edge functions and RLS tests ([05-data-platform.md](../docs/architecture/05-data-platform.md)).

## Environments

| Env | Project | Ref | Region |
|---|---|---|---|
| Staging | `modularerp` (rename to `erp-staging` in dashboard if desired) | `bhmgdrdlwmixxwxacfwq` | `eu-central-1` |
| Production | `erp-prod` | `upwdgbjpyenkylqbvfbj` | `eu-central-1` |

The repo is `supabase link`ed to **staging**. Production is only ever touched by CI on merge to `main` ([01-tech-stack.md](../docs/architecture/01-tech-stack.md) → CI/CD); never link your working copy to prod.

## Secrets

`SUPABASE_ACCESS_TOKEN` and DB passwords live in the repo-root `.env.local` (gitignored). Load them into the shell before CLI calls; never commit or echo them.

## Local dev loop

```
pnpm exec supabase start    # local Postgres + Auth + Storage (requires Docker Desktop / WSL2)
pnpm exec supabase db reset # replay migrations + seed from scratch
pnpm exec supabase stop
```

## Migration workflow

1. `pnpm exec supabase migration new <name>` → edit the generated SQL in `migrations/`
2. Never edit an applied migration; ship a new one (repo convention, see CLAUDE.md)
3. `pnpm exec supabase db reset` locally until green, commit migration + RLS tests together
4. CI applies to staging on merge, then prod after the RLS suite passes
