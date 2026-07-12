import type { AuthError } from "@supabase/supabase-js";

const KNOWN = new Set([
  "invalid_credentials",
  "user_already_exists",
  "email_exists",
  "weak_password",
  "over_request_rate_limit",
  "mfa_verification_failed",
  "validation_failed",
]);

/** Maps a Supabase auth error to an i18n key under `auth.errors.*`. */
export function authErrorKey(error: AuthError | null): string {
  const code = error?.code ?? "";
  if (code === "email_exists") return "user_already_exists";
  // ADR-0004: the before-user-created hook rejects uninvited signups
  if (error?.message?.toLowerCase().includes("invitation")) {
    return "signup_invite_only";
  }
  return KNOWN.has(code) ? code : "unknown";
}
