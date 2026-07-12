"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { SLUG_RE } from "@/lib/slug";

export type PlatformActionState =
  | { errorKey: string }
  | { slug: string; inviteToken: string }
  | null;

export async function adminCreateCompany(
  _prev: PlatformActionState,
  formData: FormData
): Promise<PlatformActionState> {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(80),
      slug: z.string().regex(SLUG_RE),
      ownerEmail: z.string().trim().toLowerCase().email().max(254),
    })
    .safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      ownerEmail: formData.get("ownerEmail"),
    });
  if (!parsed.success) return { errorKey: "invalidInput" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("admin_create_company", {
      company_name: parsed.data.name,
      company_slug: parsed.data.slug,
      owner_email: parsed.data.ownerEmail,
    })
    .single<{ id: string; slug: string; invite_token: string }>();

  if (error || !data) {
    if (error?.code === "23505") return { errorKey: "conflict" };
    if (error?.code === "42501") return { errorKey: "notAllowed" };
    return { errorKey: error?.code === "22000" ? "invalidInput" : "unknown" };
  }

  revalidatePath("/admin");
  return { slug: data.slug, inviteToken: data.invite_token };
}
