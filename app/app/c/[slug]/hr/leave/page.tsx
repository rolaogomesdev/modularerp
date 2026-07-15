import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, Button, EmptyState, PageHeader } from "@repo/ui";
import { CalendarClock } from "lucide-react";

import { LEAVE_STATUS_VARIANT, type LeaveStatus } from "@/lib/leave";
import { createClient } from "@/lib/supabase/server";

const DATE_RANGE_SEP = " – ";
const NAME_TYPE_SEP = " — ";

type LeaveRow = {
  id: string;
  subject_user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  approval_id: string | null;
  created_at: string;
};

export default async function LeaveListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("leave");
  const format = await getFormatter();
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!company) notFound();

  const [{ data }, { data: directory }] = await Promise.all([
    supabase
      .from("hr_leave_requests")
      .select("id, subject_user_id, leave_type, start_date, end_date, approval_id, created_at")
      .eq("company_id", company.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("member_directory").select("id, display_name"),
  ]);
  const rows = (data ?? []) as LeaveRow[];

  const nameOf = new Map<string, string>(
    (directory ?? []).map((d: { id: string; display_name: string }) => [
      d.id,
      d.display_name,
    ])
  );

  // Status derives from the linked approval (visible under its own RLS).
  const approvalIds = rows.map((r) => r.approval_id).filter(Boolean) as string[];
  const { data: apps } = approvalIds.length
    ? await supabase.from("approvals").select("id, status").in("id", approvalIds)
    : { data: [] };
  const statusOf = new Map<string, LeaveStatus>(
    (apps ?? []).map((a: { id: string; status: LeaveStatus }) => [a.id, a.status])
  );

  const fmtDate = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium" });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        backHref={`/c/${slug}`}
        backLabel={t("back")}
        action={
          <div className="flex items-center gap-2">
            <a
              href={`/c/${slug}/hr/leave/export`}
              className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-accent transition-colors duration-fast hover:bg-accent-muted"
            >
              {t("export.button")}
            </a>
            <Button asChild size="sm">
              <Link href={`/c/${slug}/hr/leave/new`}>{t("new")}</Link>
            </Button>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={<CalendarClock aria-hidden />} title={t("empty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const status: LeaveStatus = row.approval_id
              ? (statusOf.get(row.approval_id) ?? "pending")
              : "pending";
            return (
              <li key={row.id}>
                <Link
                  href={`/c/${slug}/hr/leave/${row.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-1 transition-colors duration-fast hover:bg-accent-muted"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {nameOf.get(row.subject_user_id) ?? t("unknownMember")}
                      {NAME_TYPE_SEP}
                      {t(`types.${row.leave_type}`)}
                    </span>
                    <span className="text-xs text-text-faint">
                      {fmtDate(row.start_date)}
                      {DATE_RANGE_SEP}
                      {fmtDate(row.end_date)}
                    </span>
                  </div>
                  <Badge variant={LEAVE_STATUS_VARIANT[status]}>
                    {t(`status.${status}`)}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
