"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { isLocale, LOCALE_COOKIE } from "@repo/i18n";

import { createClient } from "@/lib/supabase/server";
import { THEME_COOKIE } from "@/lib/theme";

export type ProfileActionState = { errorKey: string } | { saved: true } | null;

const THEMES = ["system", "light", "dark"] as const;

const YEAR = 60 * 60 * 24 * 365;

async function ownProfileUpdate(
  values: Record<string, unknown>
): Promise<ProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errorKey: "notAllowed" };

  const { error } = await supabase
    .from("profiles")
    .update(values)
    .eq("id", user.id);
  if (error) return { errorKey: "unknown" };
  return { saved: true };
}

export async function updateIdentity(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const parsed = z
    .object({ displayName: z.string().trim().min(1).max(80) })
    .safeParse({ displayName: formData.get("displayName") });
  if (!parsed.success) return { errorKey: "invalidInput" };

  const result = await ownProfileUpdate({
    display_name: parsed.data.displayName,
  });
  if (result && "saved" in result) revalidatePath("/", "layout");
  return result;
}

export async function saveAvatarUrl(publicUrl: string): Promise<ProfileActionState> {
  const parsed = z.string().url().max(500).safeParse(publicUrl);
  if (!parsed.success) return { errorKey: "invalidInput" };

  // only OUR storage, only the caller's OWN folder — never an arbitrary URL
  // (member_directory exposes avatar_url to co-members; external hosts could track them)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errorKey: "notAllowed" };
  const ownPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.id}/`;
  if (!parsed.data.startsWith(ownPrefix)) return { errorKey: "invalidInput" };

  const result = await ownProfileUpdate({ avatar_url: parsed.data });
  if (result && "saved" in result) revalidatePath("/", "layout");
  return result;
}

export async function updatePreferences(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const parsed = z
    .object({
      locale: z.string().refine(isLocale),
      theme: z.enum(THEMES),
    })
    .safeParse({
      locale: formData.get("locale"),
      theme: formData.get("theme"),
    });
  if (!parsed.success) return { errorKey: "invalidInput" };

  const result = await ownProfileUpdate({
    locale: parsed.data.locale,
    theme: parsed.data.theme,
  });
  if (result && "saved" in result) {
    // cookies make the preference effective immediately and on every device
    // visit; the profile row is the cross-device source of truth.
    const store = await cookies();
    store.set(LOCALE_COOKIE, parsed.data.locale, {
      maxAge: YEAR,
      sameSite: "lax",
      path: "/",
    });
    store.set(THEME_COOKIE, parsed.data.theme, {
      maxAge: YEAR,
      sameSite: "lax",
      path: "/",
    });
    revalidatePath("/", "layout");
  }
  return result;
}

export async function updateNotificationPrefs(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const prefs = {
    approvals: formData.get("approvals") === "on",
    digest: formData.get("digest") === "on",
  };
  const result = await ownProfileUpdate({ notification_prefs: prefs });
  if (result && "saved" in result) revalidatePath("/me");
  return result;
}
