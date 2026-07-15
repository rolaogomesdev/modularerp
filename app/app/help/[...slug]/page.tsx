import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { findManualEntry } from "@/lib/manual";
import { createClient } from "@/lib/supabase/server";

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("help");
  const format = await getFormatter();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: audiences } = await supabase.rpc("my_manual_audiences");
  const entry = findManualEntry(
    slug.join("/"),
    (audiences as string[] | null) ?? ["member"]
  );
  if (!entry) notFound(); // hidden by audience or non-existent ⇒ does not exist

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      <Link href="/help" className="self-start text-sm text-accent">
        {t("backToIndex")}
      </Link>

      {/* Trusted content: docs/manual markdown rendered at build time. */}
      <article
        className="manual-prose"
        dangerouslySetInnerHTML={{ __html: entry.html }}
      />

      {entry.updated ? (
        <p className="border-t border-border pt-4 text-xs text-text-faint">
          {t("updated", {
            date: format.dateTime(new Date(entry.updated), { dateStyle: "long" }),
          })}
        </p>
      ) : null}
    </main>
  );
}
