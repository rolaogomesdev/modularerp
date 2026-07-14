import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CalendarClock } from "lucide-react";

import { InviteForm } from "@/components/invite-form";
import { PermissionGate } from "@/components/permission-gate";
import { RevokeInviteButton } from "@/components/revoke-invite-button";
import { createClient } from "@/lib/supabase/server";

export default async function CompanyHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("tenancy");
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, country_code, currency")
    .eq("slug", slug)
    .maybeSingle();
  if (!company) notFound();

  const [{ data: members }, { data: directory }] = await Promise.all([
    supabase
      .from("company_members")
      .select("id, user_id, status, invited_email, joined_at")
      .eq("company_id", company.id)
      .order("created_at"),
    supabase.from("member_directory").select("id, display_name"),
  ]);

  const nameOf = new Map((directory ?? []).map((d) => [d.id, d.display_name]));
  const statusStyle: Record<string, string> = {
    active: "bg-success-bg text-success",
    invited: "bg-warning-bg text-warning",
    suspended: "bg-danger-bg text-danger",
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      <section className="rounded-lg border border-border bg-surface p-4 shadow-1">
        <h1 className="text-xl font-semibold">{company.name}</h1>
        <p className="text-sm text-text-muted">
          {t("company.meta", {
            country: company.country_code,
            currency: company.currency,
          })}
        </p>
        <p className="mt-2 text-sm text-text-muted">{t("company.emptyState")}</p>
      </section>

      <Link
        href={`/c/${company.slug}/hr/leave`}
        className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-1 transition-colors duration-fast hover:bg-accent-muted"
      >
        <CalendarClock className="size-5 shrink-0 text-accent" aria-hidden />
        <span className="flex min-w-0 flex-col">
          <span className="font-medium">{t("company.leave")}</span>
          <span className="text-sm text-text-muted">{t("company.leaveHint")}</span>
        </span>
      </Link>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-text-muted">
          {t("company.members")}
        </h2>
        <ul className="flex flex-col gap-2">
          {(members ?? []).map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3 shadow-1"
            >
              <span className="min-w-0 truncate text-sm font-medium">
                {member.user_id
                  ? (nameOf.get(member.user_id) ?? t("company.unknownMember"))
                  : member.invited_email}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs ${statusStyle[member.status] ?? ""}`}
                >
                  {t(`company.status.${member.status}`)}
                </span>
                {member.user_id === null && member.status === "invited" ? (
                  <PermissionGate
                    permission="platform.member.manage"
                    companyId={company.id}
                  >
                    <RevokeInviteButton
                      invitationId={member.id}
                      companySlug={company.slug}
                    />
                  </PermissionGate>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Inviting requires platform.member.manage (Phase 1 tightening) —
          the gate hides the form; the RPC refuses regardless. */}
      <PermissionGate permission="platform.member.manage" companyId={company.id}>
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1">
          <h2 className="font-medium">{t("invite.title")}</h2>
          <InviteForm companyId={company.id} companySlug={company.slug} />
        </section>
      </PermissionGate>
    </main>
  );
}
