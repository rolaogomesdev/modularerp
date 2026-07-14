import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@repo/ui";

import { LeaveForm } from "@/components/leave/leave-form";
import { type CustomFieldDef } from "@/lib/custom-fields";
import { LEAVE_CUSTOM_ENTITY } from "@/lib/leave";
import { createClient } from "@/lib/supabase/server";

export default async function NewLeavePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("leave");
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!company) notFound();

  const { data: defsData } = await supabase
    .from("custom_field_defs")
    .select("id, entity, key, label, type, config, position, archived_at")
    .eq("company_id", company.id)
    .eq("entity", LEAVE_CUSTOM_ENTITY)
    .is("archived_at", null)
    .order("position");
  const defs = (defsData ?? []) as CustomFieldDef[];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4">
      <PageHeader
        title={t("newTitle")}
        description={t("newSubtitle")}
        backHref={`/c/${slug}/hr/leave`}
        backLabel={t("back")}
      />
      <section className="rounded-lg border border-border bg-surface p-4 shadow-1">
        <LeaveForm
          companyId={company.id}
          companySlug={company.slug}
          customDefs={defs}
        />
      </section>
    </main>
  );
}
