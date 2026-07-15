import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Badge, PageHeader } from "@repo/ui";

import { PermissionGate } from "@/components/permission-gate";
import { fieldLabel, type CustomFieldDef } from "@/lib/custom-fields";
import {
  LEAVE_CUSTOM_ENTITY,
  LEAVE_STATUS_VARIANT,
  type LeaveStatus,
} from "@/lib/leave";
import { createClient } from "@/lib/supabase/server";

const EMPTY_VALUE = "—";

type LeaveDetail = {
  id: string;
  subject_user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  custom: Record<string, unknown>;
  approval_id: string | null;
};

export default async function LeaveDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const t = await getTranslations("leave");
  const locale = await getLocale();
  const format = await getFormatter();
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!company) notFound();

  const { data: request } = await supabase
    .from("hr_leave_requests")
    .select("id, subject_user_id, leave_type, start_date, end_date, reason, custom, approval_id")
    .eq("company_id", company.id)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!request) notFound(); // RLS-filtered: not visible ⇒ does not exist

  const leave = request as LeaveDetail;

  const [{ data: directory }, { data: defsData }, approval] = await Promise.all([
    supabase.from("member_directory").select("id, display_name"),
    supabase
      .from("custom_field_defs")
      .select("id, entity, key, label, type, config, position, archived_at")
      .eq("company_id", company.id)
      .eq("entity", LEAVE_CUSTOM_ENTITY)
      .is("archived_at", null)
      .order("position"),
    leave.approval_id
      ? supabase
          .from("approvals")
          .select("status, decision_reason")
          .eq("id", leave.approval_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const defs = (defsData ?? []) as CustomFieldDef[];
  const subjectName =
    (directory ?? []).find((d: { id: string }) => d.id === leave.subject_user_id)
      ?.display_name ?? t("unknownMember");
  const status: LeaveStatus =
    (approval?.data as { status?: LeaveStatus } | null)?.status ?? "pending";
  const decisionReason = (approval?.data as { decision_reason?: string } | null)
    ?.decision_reason;

  const fmtDate = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "long" });

  const renderCustom = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return EMPTY_VALUE;
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "boolean") return value ? t("yes") : t("no");
    return String(value);
  };

  const rows: Array<{ label: string; value: string }> = [
    { label: t("subject"), value: subjectName },
    { label: t("type"), value: t(`types.${leave.leave_type}`) },
    { label: t("startDate"), value: fmtDate(leave.start_date) },
    { label: t("endDate"), value: fmtDate(leave.end_date) },
    { label: t("reason"), value: leave.reason || EMPTY_VALUE },
    ...defs.map((def) => ({
      label: fieldLabel(def, locale),
      value: renderCustom(leave.custom?.[def.key]),
    })),
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4">
      <PageHeader
        title={t("detailTitle")}
        backHref={`/c/${slug}/hr/leave`}
        backLabel={t("back")}
        action={
          <Badge variant={LEAVE_STATUS_VARIANT[status]}>
            {t(`status.${status}`)}
          </Badge>
        }
      />

      <dl className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-start justify-between gap-4 px-4 py-3"
          >
            <dt className="text-sm text-text-muted">{row.label}</dt>
            <dd className="min-w-0 break-words text-right text-sm font-medium">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {decisionReason ? (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted shadow-1">
          {decisionReason}
        </p>
      ) : null}

      {status === "pending" ? (
        <PermissionGate permission="hr.absence.approve" companyId={company.id}>
          <Link
            href={`/c/${slug}/approvals`}
            className="self-start text-sm text-accent underline-offset-4 hover:underline"
          >
            {t("decideHint")}
          </Link>
        </PermissionGate>
      ) : null}
    </main>
  );
}
