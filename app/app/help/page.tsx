import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader } from "@repo/ui";
import { BookOpen } from "lucide-react";

import { groupBySection, visibleManual } from "@/lib/manual";
import { createClient } from "@/lib/supabase/server";

const KNOWN_SECTIONS = [
  "member",
  "team-manager",
  "company-admin",
  "platform-admin",
  "concepts",
  "modules",
  "general",
];

export default async function HelpIndexPage() {
  const t = await getTranslations("help");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: audiences } = await supabase.rpc("my_manual_audiences");
  const entries = visibleManual((audiences as string[] | null) ?? ["member"]);
  const groups = groupBySection(entries);

  const sectionLabel = (section: string) =>
    KNOWN_SECTIONS.includes(section) ? t(`sections.${section}`) : section;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        backHref="/"
        backLabel={t("back")}
      />

      {entries.length === 0 ? (
        <EmptyState icon={<BookOpen aria-hidden />} title={t("empty")} />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.section} className="flex flex-col gap-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-text-faint">
                {sectionLabel(group.section)}
              </h2>
              <ul className="flex flex-col gap-2">
                {group.entries.map((entry) => (
                  <li key={entry.slug}>
                    <Link
                      href={`/help/${entry.slug}`}
                      className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface px-4 py-3 shadow-1 transition-colors duration-fast hover:bg-accent-muted"
                    >
                      <span className="text-sm font-medium">{entry.title}</span>
                      {entry.path ? (
                        <span className="font-mono text-xs text-text-faint">
                          {entry.path}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
