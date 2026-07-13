import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, EmptyState, PageHeader } from "@repo/ui";
import { CheckCheck } from "lucide-react";

import { CancelForm, DecideForm } from "@/components/approvals/decide-buttons";
import { createClient } from "@/lib/supabase/server";

type ApprovalRow = {
  id: string;
  team_id: string | null;
  requester_id: string;
  kind: string;
  summary: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decided_at: string | null;
  decision_reason: string | null;
  created_at: string;
};

export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("approvals");
  const format = await getFormatter();
  const supabase = await createClient();

  const [{ data: company }, { data: userData }] = await Promise.all([
    supabase.from("companies").select("id").eq("slug", slug).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (!company) notFound();
  const me = userData.user?.id;

  const { data } = await supabase
    .from("approvals")
    .select(
      "id, team_id, requester_id, kind, summary, status, decided_at, decision_reason, created_at"
    )
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  const approvals = (data ?? []) as ApprovalRow[];
  // RLS returned rows I can decide (authorized) OR that are mine (requester)
  const toDecide = approvals.filter(
    (a) => a.status === "pending" && a.requester_id !== me
  );
  const mine = approvals.filter((a) => a.requester_id === me);

  const label = (a: ApprovalRow) => {
    const key = `kinds.${a.kind}`;
    return t.has(key) ? t(key, a.summary as Record<string, string>) : t("kinds.generic");
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-text-muted">
          {t("toDecide", { count: toDecide.length })}
        </h2>
        {toDecide.length === 0 ? (
          <EmptyState
            icon={<CheckCheck aria-hidden />}
            title={t("nothingToDecide")}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {toDecide.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{label(a)}</span>
                  <span className="text-xs text-text-faint">
                    {format.dateTime(new Date(a.created_at), { dateStyle: "medium" })}
                  </span>
                </div>
                <DecideForm approvalId={a.id} companySlug={slug} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-text-muted">{t("myRequests")}</h2>
        {mine.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted shadow-1">
            {t("noRequests")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {mine.map((a) => {
              const variant = (
                {
                  pending: "warning",
                  approved: "success",
                  rejected: "danger",
                  cancelled: "outline",
                } as const
              )[a.status];
              return (
                <li
                  key={a.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 font-medium">{label(a)}</span>
                    <Badge variant={variant}>{t(`status.${a.status}`)}</Badge>
                  </div>
                  {a.decision_reason ? (
                    <p className="text-sm text-text-muted">{a.decision_reason}</p>
                  ) : null}
                  {a.status === "pending" ? (
                    <CancelForm approvalId={a.id} companySlug={slug} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
