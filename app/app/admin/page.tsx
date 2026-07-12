import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState, ListItem, PageHeader } from "@repo/ui";
import { Building2 } from "lucide-react";

import { ProvisionForm } from "@/components/platform/provision-form";
import { createClient } from "@/lib/supabase/server";

// Platform operations (ADR-0004): companies as OBJECTS — metadata only.
// The platform_admin app role provably reads zero business data (RLS-tested).
export default async function AdminPage() {
  const t = await getTranslations("platform");
  const format = await getFormatter();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: profile } = await supabase
    .from("profiles")
    .select("app_role")
    .eq("id", user.id)
    .maybeSingle();
  // UX pre-check; the companies metadata policy + RPC gates enforce in the DB
  if (profile?.app_role !== "platform_admin") notFound();

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, slug, created_at, deleted_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 pb-16">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Link
        href="/"
        className="-mt-4 self-start text-sm text-text-muted underline-offset-4 hover:underline"
      >
        {t("back")}
      </Link>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1">
        <h2 className="font-medium">{t("provision.title")}</h2>
        <p className="text-sm text-text-muted">{t("provision.help")}</p>
        <ProvisionForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-text-muted">
          {t("companies.title", { count: companies?.length ?? 0 })}
        </h2>
        {companies && companies.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {companies.map((company) => (
              <li key={company.id}>
                <ListItem
                  title={company.name}
                  subtitle={`/${company.slug}`}
                  meta={
                    <span className="text-xs text-text-faint">
                      {format.dateTime(new Date(company.created_at), {
                        dateStyle: "medium",
                      })}
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Building2 aria-hidden />}
            title={t("companies.empty")}
          />
        )}
      </section>
    </main>
  );
}
