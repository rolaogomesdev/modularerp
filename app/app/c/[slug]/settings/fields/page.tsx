import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge, EmptyState, PageHeader } from "@repo/ui";
import { SlidersHorizontal } from "lucide-react";

import {
  ArchiveFieldButton,
  CreateFieldForm,
} from "@/components/custom-fields/manage-fields";
import {
  fieldLabel,
  type CustomFieldDef,
} from "@/lib/custom-fields";
import { getAdminContext } from "@/lib/admin-context";
import { createClient } from "@/lib/supabase/server";

// decorative, not translatable prose
const REQUIRED_MARK = " *";
const META_SEP = " · ";

export default async function CustomFieldsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { company, can } = await getAdminContext(slug);
  if (!can.manageCustomFields) notFound();

  const t = await getTranslations("customFields");
  const locale = await getLocale();
  const supabase = await createClient();

  const { data } = await supabase
    .from("custom_field_defs")
    .select("id, entity, key, label, type, config, position, archived_at")
    .eq("company_id", company.id)
    .order("entity")
    .order("position");
  const defs = (data ?? []) as CustomFieldDef[];

  // group by entity for display
  const byEntity = new Map<string, CustomFieldDef[]>();
  for (const d of defs) {
    const list = byEntity.get(d.entity) ?? [];
    list.push(d);
    byEntity.set(d.entity, list);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4">
      <PageHeader title={t("title")} description={t("subtitle")} backHref={`/c/${slug}/settings`} backLabel={t("back")} />

      <section className="flex flex-col gap-4">
        {defs.length === 0 ? (
          <EmptyState icon={<SlidersHorizontal aria-hidden />} title={t("empty")} />
        ) : (
          [...byEntity.entries()].map(([entity, list]) => (
            <div key={entity} className="flex flex-col gap-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-text-faint">
                {t(`entities.${entity}`)}
              </h2>
              <ul className="flex flex-col gap-2">
                {list.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3 shadow-1"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {fieldLabel(d, locale)}
                        {d.config.required ? (
                          <span className="text-danger">{REQUIRED_MARK}</span>
                        ) : null}
                      </span>
                      <span className="font-mono text-xs text-text-faint">
                        {d.key}
                        {META_SEP}
                        {t(`types.${d.type}`)}
                      </span>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      {d.archived_at ? (
                        <Badge variant="outline">{t("archived")}</Badge>
                      ) : null}
                      <ArchiveFieldButton
                        id={d.id}
                        companyId={company.id}
                        companySlug={slug}
                        archived={d.archived_at !== null}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1">
        <h2 className="font-medium">{t("createTitle")}</h2>
        <p className="text-sm text-text-muted">{t("createHelp")}</p>
        <CreateFieldForm companyId={company.id} companySlug={slug} />
      </section>
    </main>
  );
}
