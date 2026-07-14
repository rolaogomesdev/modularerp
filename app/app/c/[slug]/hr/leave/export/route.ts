import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { toCsv, type CsvColumn } from "@/lib/csv";
import { fieldLabel, type CustomFieldDef } from "@/lib/custom-fields";
import { LEAVE_CUSTOM_ENTITY, type LeaveStatus } from "@/lib/leave";
import { createClient } from "@/lib/supabase/server";

type LeaveRow = {
  id: string;
  subject_user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  custom: Record<string, unknown>;
  approval_id: string | null;
};

/**
 * Streams leave requests as CSV. Rows are RLS-scoped to the caller. Columns for
 * the admin's custom fields are appended dynamically — the "a custom field
 * appears in export untouched by code" half of the Phase 2 exit criterion.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const t = await getTranslations("leave");
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!company) notFound();

  const [{ data }, { data: directory }, { data: defsData }] = await Promise.all([
    supabase
      .from("hr_leave_requests")
      .select("id, subject_user_id, leave_type, start_date, end_date, reason, custom, approval_id")
      .eq("company_id", company.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("member_directory").select("id, display_name"),
    supabase
      .from("custom_field_defs")
      .select("id, entity, key, label, type, config, position, archived_at")
      .eq("company_id", company.id)
      .eq("entity", LEAVE_CUSTOM_ENTITY)
      .is("archived_at", null)
      .order("position"),
  ]);
  const rows = (data ?? []) as LeaveRow[];
  const defs = (defsData ?? []) as CustomFieldDef[];

  const approvalIds = rows.map((r) => r.approval_id).filter(Boolean) as string[];
  const { data: apps } = approvalIds.length
    ? await supabase.from("approvals").select("id, status").in("id", approvalIds)
    : { data: [] };
  const statusOf = new Map<string, LeaveStatus>(
    (apps ?? []).map((a: { id: string; status: LeaveStatus }) => [a.id, a.status])
  );
  const nameOf = new Map<string, string>(
    (directory ?? []).map((d: { id: string; display_name: string }) => [
      d.id,
      d.display_name,
    ])
  );

  const statusOfRow = (r: LeaveRow): LeaveStatus =>
    r.approval_id ? (statusOf.get(r.approval_id) ?? "pending") : "pending";

  const columns: CsvColumn<LeaveRow>[] = [
    { header: t("export.subject"), value: (r) => nameOf.get(r.subject_user_id) ?? "" },
    { header: t("export.type"), value: (r) => t(`types.${r.leave_type}`) },
    { header: t("export.start"), value: (r) => r.start_date },
    { header: t("export.end"), value: (r) => r.end_date },
    { header: t("export.status"), value: (r) => t(`status.${statusOfRow(r)}`) },
    { header: t("export.reason"), value: (r) => r.reason ?? "" },
    ...defs.map((def) => ({
      header: fieldLabel(def, locale),
      value: (r: LeaveRow) => {
        const v = r.custom?.[def.key];
        if (v === null || v === undefined) return "";
        if (Array.isArray(v)) return v.join("; ");
        if (typeof v === "boolean") return v ? t("yes") : t("no");
        return String(v);
      },
    })),
  ];

  await Promise.all([
    supabase.rpc("log_audit", {
      target_company_id: company.id,
      audit_action: "leave.export",
      audit_entity: "hr_leave_requests",
      entry_after: { format: "csv", rows: rows.length },
    }),
    supabase.rpc("record_security_event", {
      event_kind: "data.export",
      target_company: company.id,
      event_details: { entity: "hr_leave_requests", format: "csv", rows: rows.length },
    }),
  ]);

  const body = "﻿" + toCsv(columns, rows);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leave-${company.slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
