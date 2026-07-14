import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { AssignMembershipForm } from "@/components/admin/assign-membership-form";
import {
  MemberStatusButton,
  RemoveMembershipButton,
} from "@/components/admin/member-buttons";
import { getAdminContext } from "@/lib/admin-context";
import { createClient } from "@/lib/supabase/server";

// decorative separator, not translatable prose
const SEPARATOR = " · ";

type MemberRow = {
  id: string;
  user_id: string | null;
  status: string;
  invited_email: string | null;
};

type MembershipRow = {
  id: string;
  member_id: string;
  team_id: string;
  company_role_id: string;
  valid_from: string;
  valid_to: string | null;
};

export default async function MembersSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { company, can } = await getAdminContext(slug);
  if (!can.manageMembers) notFound();

  const t = await getTranslations("admin");
  const locale = await getLocale();
  const supabase = await createClient();

  const [
    { data: membersData },
    { data: directory },
    { data: teams },
    { data: roles },
    { data: membershipsData },
  ] = await Promise.all([
    supabase
      .from("company_members")
      .select("id, user_id, status, invited_email")
      .eq("company_id", company.id)
      .order("created_at"),
    supabase.from("member_directory").select("id, display_name"),
    supabase
      .from("teams")
      .select("id, name")
      .eq("company_id", company.id)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("company_roles")
      .select("id, name")
      .eq("company_id", company.id)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("team_memberships")
      .select("id, member_id, team_id, company_role_id, valid_from, valid_to")
      .eq("company_id", company.id)
      .order("valid_from"),
  ]);

  const members: MemberRow[] = membersData ?? [];
  const memberships: MembershipRow[] = membershipsData ?? [];

  const nameOf = new Map<string, string>(
    (directory ?? []).map((entry: { id: string; display_name: string }) => [
      entry.id,
      entry.display_name,
    ])
  );
  const teamNameOf = new Map<string, string>(
    (teams ?? []).map((team: { id: string; name: string }) => [
      team.id,
      team.name,
    ])
  );
  const roleNameOf = new Map<string, string>(
    (roles ?? []).map((role: { id: string; name: string }) => [
      role.id,
      role.name,
    ])
  );

  const labelOf = (member: MemberRow) =>
    (member.user_id ? nameOf.get(member.user_id) : null) ??
    member.invited_email ??
    "";

  const memberLabelById = new Map<string, string>(
    members.map((member) => [member.id, labelOf(member)])
  );

  const membershipsByMember = new Map<string, MembershipRow[]>();
  for (const membership of memberships) {
    const list = membershipsByMember.get(membership.member_id) ?? [];
    list.push(membership);
    membershipsByMember.set(membership.member_id, list);
  }

  const delegations = memberships.filter(
    (membership) => membership.valid_to !== null
  );

  const dateFormatter = new Intl.DateTimeFormat(locale);
  const formatDate = (iso: string) => dateFormatter.format(new Date(iso));

  const statusStyle: Record<string, string> = {
    active: "bg-success-bg text-success",
    invited: "bg-warning-bg text-warning",
    suspended: "bg-danger-bg text-danger",
  };

  const assignableMembers = members
    .filter((member) => member.user_id !== null && member.status === "active")
    .map((member) => ({ id: member.id, label: labelOf(member) }));

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 p-4">
      <header className="flex flex-col gap-2">
        <Link
          href={`/c/${company.slug}/settings`}
          className="text-sm text-accent"
        >
          {t("back")}
        </Link>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">{t("members.title")}</h1>
          <a
            href={`/c/${company.slug}/settings/members/export`}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-accent transition-colors duration-fast hover:bg-accent-muted"
          >
            {t("members.export.button")}
          </a>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        {members.map((member) => {
          const rows = membershipsByMember.get(member.id) ?? [];
          return (
            <article
              key={member.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium">
                  {labelOf(member)}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs ${statusStyle[member.status] ?? ""}`}
                  >
                    {t(`members.${member.status}`)}
                  </span>
                  {member.user_id !== null ? (
                    <MemberStatusButton
                      companyId={company.id}
                      companySlug={company.slug}
                      memberId={member.id}
                      suspended={member.status === "suspended"}
                    />
                  ) : null}
                </span>
              </div>

              {rows.length === 0 ? (
                <p className="text-sm text-text-muted">
                  {t("members.noRoles")}
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {rows.map((membership) => (
                    <li
                      key={membership.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="min-w-0 truncate text-sm text-text-muted">
                        {[
                          teamNameOf.get(membership.team_id),
                          roleNameOf.get(membership.company_role_id),
                          membership.valid_to
                            ? t("members.until", {
                                date: formatDate(membership.valid_to),
                              })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(SEPARATOR)}
                      </span>
                      <RemoveMembershipButton
                        companyId={company.id}
                        companySlug={company.slug}
                        membershipId={membership.id}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1">
        <h2 className="font-medium">{t("members.assignTitle")}</h2>
        <AssignMembershipForm
          companyId={company.id}
          companySlug={company.slug}
          members={assignableMembers}
          teams={(teams ?? []).map((team: { id: string; name: string }) => ({
            id: team.id,
            name: team.name,
          }))}
          roles={(roles ?? []).map((role: { id: string; name: string }) => ({
            id: role.id,
            name: role.name,
          }))}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1">
        <h2 className="font-medium">{t("members.delegationsTitle")}</h2>
        {delegations.length === 0 ? (
          <p className="text-sm text-text-muted">
            {t("members.delegationsEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {delegations.map((membership) => (
              <li
                key={membership.id}
                className="min-w-0 truncate text-sm text-text-muted"
              >
                {[
                  memberLabelById.get(membership.member_id),
                  roleNameOf.get(membership.company_role_id),
                  membership.valid_to
                    ? t("members.until", {
                        date: formatDate(membership.valid_to),
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(SEPARATOR)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
