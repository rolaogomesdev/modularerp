import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AdminContext = {
  company: { id: string; name: string; slug: string };
  can: {
    manageTeams: boolean;
    manageMembers: boolean;
    manageRoles: boolean;
    readAudit: boolean;
    any: boolean;
  };
};

/**
 * Loads the company and the caller's admin capabilities (UX pre-check only —
 * RLS remains the enforcement point). 404s for non-members and for members
 * with no admin permission at all: for them, settings does not exist.
 */
export async function getAdminContext(slug: string): Promise<AdminContext> {
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!company) notFound();

  const check = (permission: string) =>
    supabase
      .rpc("authorize", { p_permission: permission, p_company: company.id })
      .then(({ data }) => data === true);

  const [manageTeams, manageMembers, manageRoles, readAudit] = await Promise.all([
    check("platform.team.manage"),
    check("platform.member.manage"),
    check("platform.role.manage"),
    check("platform.audit.read"),
  ]);

  const can = {
    manageTeams,
    manageMembers,
    manageRoles,
    readAudit,
    // readAudit deliberately excluded until an audit sub-page exists —
    // link visibility (company page) and hub access must agree.
    any: manageTeams || manageMembers || manageRoles,
  };
  if (!can.any) notFound();

  return { company, can };
}
