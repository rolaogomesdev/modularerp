// CI gate (Phase 0 exit criterion): a tenant table without RLS + an RLS test is a red build.
// Scans supabase/migrations for created tables; each must (1) enable row level
// security in some migration and (2) be referenced by at least one file in supabase/tests.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "supabase/migrations";
const TESTS_DIR = "supabase/tests";

// Tables that intentionally carry no RLS (none yet — additions need review).
const EXEMPT = new Set([]);

const read = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");

const migrations = read(MIGRATIONS_DIR);
const tests = read(TESTS_DIR);

const created = [...migrations.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi)]
  .map((m) => m[1].toLowerCase())
  .filter((t) => !EXEMPT.has(t));

const failures = [];
for (const table of new Set(created)) {
  const rls = new RegExp(
    `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
    "i"
  ).test(migrations);
  const tested = tests.includes(table);
  if (!rls) failures.push(`${table}: no "enable row level security" found in migrations`);
  if (!tested) failures.push(`${table}: not referenced by any file in ${TESTS_DIR}`);
}

if (failures.length > 0) {
  console.error("RLS coverage check FAILED:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`RLS coverage check OK (${new Set(created).size} tables verified).`);
