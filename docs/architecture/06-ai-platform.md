# 06 — AI platform

AI is a platform capability, not a chatbot bolted on. Four surfaces — **help assistant**, **data analyst**, **module copilots**, **legislation engine** — all through one server-side gateway with the same guardrails: *acts as the user, proposes rather than mutates, always audited, always budgeted*.

## Gateway (`packages/ai`)

The only place the Claude API is called. Every request goes through:

```
caller (server action / worker)
  → gate: module AI enabled? company kill-switch off? budget left?
  → context: surface, user JWT, company, locale, country
  → model routing (table below)
  → tool loop (allowlisted tools for that surface, executed with the USER's supabase client)
  → audit + usage metering
```

| Task | Model | Why |
|---|---|---|
| Assistant / analyst / copilots | `claude-sonnet-5` | Best reasoning-per-euro for tool use |
| Bulk extraction & classification (OCR post-processing, expense categorization) | Haiku | High volume, low complexity |
| Legislation drafting (rule-pack proposals) | Opus-tier | Highest stakes, low volume |

Routing is one table in code; changing a model is a one-line PR.

**Non-negotiables** (from CLAUDE.md):
- Tools execute with the **requesting user's JWT** — RLS applies; there is no service-role path in any AI tool. The AI can never see more than the person asking.
- **AI proposes, humans approve**: anything that would write business data becomes an `approval_request` (the platform primitive), never a direct write.
- Every call logged to `ai_actions(company_id, user_id, surface, model, tools_used, input_summary, output_summary, tokens, cost, created_at)`; visible to company admins, feeds the Security module.
- **Budgets**: `ai_usage` aggregates cost per company/month; hitting the cap degrades gracefully (assistant explains; admin can raise). Per-company **kill-switch** disables all AI instantly.
- Prompt-injection posture: retrieved documents and OCR'd text are wrapped as untrusted data (never as instructions); tool allowlists are per-surface; tool inputs are zod-validated; high-risk tools (none in v1) would require step-up confirmation in-app.

## RAG infrastructure (pgvector)

```sql
create table doc_chunks (
  id         uuid primary key default gen_random_uuid(),
  source     text not null,      -- 'manual' | 'architecture' | 'legislation'
  country    text,               -- 'PT' for legislation; null = universal
  locale     text not null default 'en',
  audience   text[],             -- manual pages: who may retrieve this
  permissions text[],            -- manual pages: permission keys the reader should hold
  path       text,               -- in-app navigation path from front-matter
  source_ref text not null,      -- file path / diploma id + article
  content    text not null,
  embedding  vector(1536),
  updated_at timestamptz not null default now()
);
```

Ingestion = a job (`ai.rag_ingest`) run on docs changes (CI hook) and legislation updates: chunk → embed → upsert by `source_ref`. Retrieval always filters by `source` + (for manual content) the asker's audience/permissions + locale, and by `country` for legislation.

## Surface 1 — Help assistant ("how do I…?")

Grounded on `docs/manual/` **and** `docs/architecture/` — this is why every manual page carries front-matter with `audience`, `permissions`, and the exact `path` (CLAUDE.md rule). The assistant:

1. retrieves chunks filtered to the user's audience/permissions/locale;
2. answers with the **exact navigation path** ("HR → Absences → Pending") and required permission, citing the manual page;
3. can emit a `navigate` suggestion the shell renders as a tappable deep link;
4. says "you don't have access to this — ask an admin for `hr.absence.approve`" when the user lacks the permission, instead of leaking admin instructions.

## Surface 2 — Data analyst ("what was overtime cost in May?")

Tools (all read-only, all RLS-bound):
- `list_report_views()` → the `rpt_*` catalog with column descriptions + the company's custom field defs ([05-data-platform.md](05-data-platform.md));
- `query_report(view, select, filters, group_by, limit)` → structured query builder over `rpt_*` views only — **no raw SQL tool**; executed with the user's client (`security_invoker` views make RLS bite);
- `render_chart(spec)` → validated chart spec rendered by the design system's chart components.

Scheduled reports: a saved question + recipients becomes a job; results deliver as notifications. Every answer shows "based on: rpt_hr_absences (12 rows)" provenance.

## Surface 3 — Module copilots

Declared by modules via `aiTools` in the registry ([04-module-system.md](04-module-system.md)). Launch set:
- **Document intake (Finance)**: photo/PDF → Storage → OCR+Haiku extraction → *draft* expense/invoice with confidence flags → human confirms (approval primitive). ([08-mobile-ux.md](08-mobile-ux.md) covers camera capture.)
- **HR drafting**: contract/letter drafts from templates + employee record; anomaly flags ("vacation balance negative").
- **Finance hygiene**: duplicate-invoice detection, cash-flow forecast draft, reconciliation suggestions.

All outputs are drafts pending human confirmation — no exceptions.

## Surface 4 — Legislation engine (rule packs)

**Law lives as data.** Modules never hard-code country rules; they read active rule packs.

```sql
create table rule_packs (
  id            uuid primary key default gen_random_uuid(),
  country       text not null,             -- 'PT'
  namespace     text not null,             -- 'payroll' | 'leave' | 'invoicing' | 'social_security'
  version       int not null,
  status        text not null default 'draft',  -- draft → in_review → active → retired
  effective_from date not null,
  effective_to   date,
  rules         jsonb not null,            -- machine-readable (zod schema per namespace)
  citations     jsonb not null,            -- [{source_ref, url, quote, article}]
  ai_drafted    boolean not null default false,
  created_by    uuid not null,             -- user or 'ai' actor recorded in audit
  approved_by   uuid,                      -- REQUIRED for active; ≠ created_by
  approved_at   timestamptz,
  unique (country, namespace, version)
);
```

Example (`PT/payroll` excerpt): `{"tsu_employer": 0.2375, "tsu_employee": 0.11, "meal_allowance_exempt_card": 10.20, "irs_tables_ref": "2026-01"}` — every value paired with a citation.

**Flow**: legislation corpus ingested into RAG (official sources per country) → AI drafts a rule-pack diff *with citations* when it detects a change (scheduled job) or on request → status `in_review` → a human holding `compliance.rules.approve` reviews side-by-side (old vs new, citations linked) → activates with an effective date → modules resolve `getRule(company, namespace, key, onDate)` by the company's country and the date — historical calculations stay correct because old versions stay queryable.

**Boundary (also a compliance stance)**: the AI is a *research assistant with citations*, never an authority. Activation is a human act, recorded. Rule-pack values in doubt get flagged for professional review (accountant/lawyer), and the UI says so.

## Evaluation & quality

- Golden Q&A sets per corpus (manual questions with known paths; legislation questions with known citations; analyst questions with known numbers from seed data) run in CI on prompt/model changes.
- Assistant answers carry a feedback control (👍/👎 + comment) → `ai_feedback` → reviewed when tuning.
- Track per-surface: groundedness (citations present), tool-error rate, budget burn, latency (mobile budgets in [08](08-mobile-ux.md)).
