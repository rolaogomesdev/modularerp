import { notFound } from "next/navigation";
import { createAuthorize } from "@repo/permissions";

import { createClient } from "@/lib/supabase/server";

export type AdminContext = {
  company: { id: string; name: string; slug: string };
  can: {
    manageTeams: boolean;
    manageMembers: boolean;
    manageRoles: boolean;
    manageCustomFields: boolean;
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

  const authorize = createAuthorize(supabase);
  const companyId = company.id;
  const [manageTeams, manageMembers, manageRoles, manageCustomFields, readAudit] =
    await Promise.all([
      authorize({ permission: "platform.team.manage", companyId }),
      authorize({ permission: "platform.member.manage", companyId }),
      authorize({ permission: "platform.role.manage", companyId }),
      authorize({ permission: "platform.customfield.manage", companyId }),
      authorize({ permission: "platform.audit.read", companyId }),
    ]);

  const can = {
    manageTeams,
    manageMembers,
    manageRoles,
    manageCustomFields,
    readAudit,
    // readAudit deliberately excluded until an audit sub-page exists —
    // link visibility (company page) and hub access must agree.
    any: manageTeams || manageMembers || manageRoles || manageCustomFields,
  };
  if (!can.any) notFound();

  return { company, can };
}
