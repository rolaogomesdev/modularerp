"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type ActionState = { errorKey: string } | { token: string } | null;

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

const createCompanySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().regex(SLUG_RE),
});

const inviteSchema = z.object({
  companyId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(254),
});

/** Maps Postgres/RPC error codes to i18n keys under `tenancy.errors.*`. */
function rpcErrorKey(code: string | undefined, fallback: string): string {
  switch (code) {
    case "23505":
      return "conflict";
    case "42501":
      return "notAllowed";
    case "P0002":
      return "inviteInvalid";
    case "22000":
    case "23514":
      return "invalidInput";
    default:
      return fallback;
  }
}

export async function createCompany(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createCompanySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return { errorKey: "invalidInput" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("create_company", {
      company_name: parsed.data.name,
      company_slug: parsed.data.slug,
    })
    .single<{ id: string; slug: string }>();

  if (error || !data) return { errorKey: rpcErrorKey(error?.code, "unknown") };
  redirect(`/c/${data.slug}`);
}

export async function inviteMember(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = inviteSchema.safeParse({
    companyId: formData.get("companyId"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { errorKey: "invalidInput" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_member", {
    target_company_id: parsed.data.companyId,
    invitee_email: parsed.data.email,
  });

  if (error || !data) return { errorKey: rpcErrorKey(error?.code, "unknown") };
  return { token: data as string };
}

export async function acceptInvitation(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = z.string().uuid().safeParse(formData.get("token"));
  if (!parsed.success) return { errorKey: "inviteInvalid" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("accept_invitation", { token: parsed.data })
    .single<{ company_id: string; company_slug: string }>();

  if (error || !data) return { errorKey: rpcErrorKey(error?.code, "unknown") };
  redirect(`/c/${data.company_slug}`);
}
