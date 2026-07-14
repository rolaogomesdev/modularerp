import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getAdminContext } from "@/lib/admin-context";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";

// Membership lines are packed into one cell, separated for readability.
const ROLE_JOIN = "; ";
const ROLE_PARTS = " · ";

type ExportRow = {
  name: string;
  status: string;
  invitedEmail: string;
  roles: string;
};

/**
 * Streams the company roster as a CSV download. The query runs as the calling
 * user, so RLS — not this handler — decides which rows are visible; the admin
 * context additionally 404s anyone without member-management permission.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
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
      .is("deleted_at", null),
    supabase
      .from("company_roles")
      .select("id, name")
      .eq("company_id", company.id)
      .is("deleted_at", null),
    supabase
      .from("team_memberships")
      .select("member_id, team_id, company_role_id, valid_to")
      .eq("company_id", company.id)
      .order("valid_from"),
  ]);

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

  const dateFormatter = new Intl.DateTimeFormat(locale);
  const rolesByMember = new Map<string, string[]>();
  for (const membership of membershipsData ?? []) {
    const parts = [
      teamNameOf.get(membership.team_id),
      roleNameOf.get(membership.company_role_id),
      membership.valid_to
        ? t("members.until", {
            date: dateFormatter.format(new Date(membership.valid_to)),
          })
        : null,
    ].filter(Boolean);
    const list = rolesByMember.get(membership.member_id) ?? [];
    list.push(parts.join(ROLE_PARTS));
    rolesByMember.set(membership.member_id, list);
  }

  const rows: ExportRow[] = (membersData ?? []).map((member) => ({
    name:
      (member.user_id ? nameOf.get(member.user_id) : null) ??
      member.invited_email ??
      "",
    status: t(`members.${member.status}`),
    invitedEmail: member.invited_email ?? "",
    roles: (rolesByMember.get(member.id) ?? []).join(ROLE_JOIN),
  }));

  const columns: CsvColumn<ExportRow>[] = [
    { header: t("members.export.name"), value: (r) => r.name },
    { header: t("members.export.status"), value: (r) => r.status },
    { header: t("members.export.email"), value: (r) => r.invitedEmail },
    { header: t("members.export.roles"), value: (r) => r.roles },
  ];

  // Record the export: satisfies the audit trail and seeds the "export
  // volume" security signal (rows leaving the tenant, by whom, when).
  await supabase.rpc("log_audit", {
    target_company_id: company.id,
    audit_action: "member.export",
    audit_entity: "company_members",
    entry_after: { format: "csv", rows: rows.length },
  });

  // Lead with a UTF-8 BOM so spreadsheet apps render Portuguese accents.
  const body = "﻿" + toCsv(columns, rows);
  const filename = `members-${company.slug}.csv`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
