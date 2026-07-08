"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type AdminActionState = { errorKey: string } | null;

/** Maps Postgres/RLS error codes to i18n keys under `admin.errors.*`. */
function adminErrorKey(code: string | undefined): string {
  switch (code) {
    case "23505":
      return "conflict";
    case "42501":
      return "notAllowed";
    case "23514":
      return "invalidInput";
    case "PT001":
      return "ownerProtected";
    default:
      return "unknown";
  }
}

const slugSchema = z.string().min(1).max(40);
const uuid = z.string().uuid();

async function audit(
  companyId: string,
  action: string,
  entity: string,
  entityId: string | null,
  before: unknown,
  after: unknown
) {
  const supabase = await createClient();
  // Best-effort from the caller's session; the DB stamps the actor.
  await supabase.rpc("log_audit", {
    target_company_id: companyId,
    audit_action: action,
    audit_entity: entity,
    audit_entity_id: entityId,
    entry_before: before ?? undefined,
    entry_after: after ?? undefined,
  });
}

export async function createTeam(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const parsed = z
    .object({
      companyId: uuid,
      companySlug: slugSchema,
      name: z.string().trim().min(1).max(80),
    })
    .safeParse({
      companyId: formData.get("companyId"),
      companySlug: formData.get("companySlug"),
      name: formData.get("name"),
    });
  if (!parsed.success) return { errorKey: "invalidInput" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .insert({ company_id: parsed.data.companyId, name: parsed.data.name })
    .select("id")
    .single();
  if (error || !data) return { errorKey: adminErrorKey(error?.code) };

  await audit(parsed.data.companyId, "team.create", "teams", data.id, null, {
    name: parsed.data.name,
  });
  revalidatePath(`/c/${parsed.data.companySlug}/settings/teams`);
  return null;
}

export async function createRole(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const parsed = z
    .object({
      companyId: uuid,
      companySlug: slugSchema,
      name: z.string().trim().min(1).max(80),
      description: z.string().trim().max(200).optional(),
    })
    .safeParse({
      companyId: formData.get("companyId"),
      companySlug: formData.get("companySlug"),
      name: formData.get("name"),
      description: formData.get("description") ?? undefined,
    });
  if (!parsed.success) return { errorKey: "invalidInput" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_roles")
    .insert({
      company_id: parsed.data.companyId,
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .select("id")
    .single();
  if (error || !data) return { errorKey: adminErrorKey(error?.code) };

  await audit(parsed.data.companyId, "role.create", "company_roles", data.id, null, {
    name: parsed.data.name,
  });
  revalidatePath(`/c/${parsed.data.companySlug}/settings/roles`);
  return null;
}

/** scope 'none' removes the grant; own|team|company upserts it. */
export async function setRoleGrant(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const parsed = z
    .object({
      companyId: uuid,
      companySlug: slugSchema,
      roleId: uuid,
      permissionKey: z.string().regex(/^[a-z0-9_]+\.[a-z0-9_]+\.[a-z0-9_]+$/),
      scope: z.enum(["none", "own", "team", "company"]),
    })
    .safeParse({
      companyId: formData.get("companyId"),
      companySlug: formData.get("companySlug"),
      roleId: formData.get("roleId"),
      permissionKey: formData.get("permissionKey"),
      scope: formData.get("scope"),
    });
  if (!parsed.success) return { errorKey: "invalidInput" };
  const { companySlug, roleId, permissionKey, scope } = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("role_permissions")
    .select("scope")
    .eq("company_role_id", roleId)
    .eq("permission_key", permissionKey)
    .maybeSingle();

  // change = delete old grant (if any) + insert new one (RLS gates both)
  if (existing) {
    const { error: delError } = await supabase
      .from("role_permissions")
      .delete()
      .eq("company_role_id", roleId)
      .eq("permission_key", permissionKey);
    if (delError) return { errorKey: adminErrorKey(delError.code) };
  }
  if (scope !== "none") {
    const { error: insError } = await supabase.from("role_permissions").insert({
      company_role_id: roleId,
      permission_key: permissionKey,
      scope,
    });
    if (insError) return { errorKey: adminErrorKey(insError.code) };
  }

  // grant changes are audited by DB triggers (permission_change_audit)
  revalidatePath(`/c/${companySlug}/settings/roles`);
  return null;
}

export async function assignMembership(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const parsed = z
    .object({
      companyId: uuid,
      companySlug: slugSchema,
      teamId: uuid,
      memberId: uuid,
      roleId: uuid,
      validTo: z.string().optional(), // yyyy-mm-dd from <input type="date">
    })
    .safeParse({
      companyId: formData.get("companyId"),
      companySlug: formData.get("companySlug"),
      teamId: formData.get("teamId"),
      memberId: formData.get("memberId"),
      roleId: formData.get("roleId"),
      validTo: formData.get("validTo") || undefined,
    });
  if (!parsed.success) return { errorKey: "invalidInput" };

  let validTo: string | null = null;
  if (parsed.data.validTo) {
    const date = new Date(`${parsed.data.validTo}T23:59:59Z`);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      return { errorKey: "invalidInput" };
    }
    validTo = date.toISOString();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errorKey: "notAllowed" };

  const { data, error } = await supabase
    .from("team_memberships")
    .insert({
      company_id: parsed.data.companyId,
      team_id: parsed.data.teamId,
      member_id: parsed.data.memberId,
      company_role_id: parsed.data.roleId,
      valid_to: validTo,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { errorKey: adminErrorKey(error?.code) };

  // membership changes are audited by DB triggers (permission_change_audit)
  revalidatePath(`/c/${parsed.data.companySlug}/settings/members`);
  return null;
}

export async function removeMembership(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const parsed = z
    .object({ companyId: uuid, companySlug: slugSchema, membershipId: uuid })
    .safeParse({
      companyId: formData.get("companyId"),
      companySlug: formData.get("companySlug"),
      membershipId: formData.get("membershipId"),
    });
  if (!parsed.success) return { errorKey: "invalidInput" };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("team_memberships")
    .delete({ count: "exact" })
    .eq("id", parsed.data.membershipId);
  if (error) return { errorKey: adminErrorKey(error.code) };
  if (!count) return { errorKey: "notAllowed" };

  // membership changes are audited by DB triggers (permission_change_audit)
  revalidatePath(`/c/${parsed.data.companySlug}/settings/members`);
  return null;
}

async function setMemberStatus(
  formData: FormData,
  status: "active" | "suspended",
  action: "member.reactivate" | "member.suspend"
): Promise<AdminActionState> {
  const parsed = z
    .object({ companyId: uuid, companySlug: slugSchema, memberId: uuid })
    .safeParse({
      companyId: formData.get("companyId"),
      companySlug: formData.get("companySlug"),
      memberId: formData.get("memberId"),
    });
  if (!parsed.success) return { errorKey: "invalidInput" };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("company_members")
    .update({ status }, { count: "exact" })
    .eq("id", parsed.data.memberId);
  if (error) return { errorKey: adminErrorKey(error.code) };
  if (!count) return { errorKey: "notAllowed" };

  await audit(parsed.data.companyId, action, "company_members", parsed.data.memberId, null, {
    status,
  });
  revalidatePath(`/c/${parsed.data.companySlug}/settings/members`);
  return null;
}

export async function suspendMember(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  return setMemberStatus(formData, "suspended", "member.suspend");
}

export async function reactivateMember(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  return setMemberStatus(formData, "active", "member.reactivate");
}
