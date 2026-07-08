import { createAuthorize } from "@repo/permissions";
import { createPermissionGate } from "@repo/permissions/react";

import { createClient } from "@/lib/supabase/server";

/**
 * Server-component PermissionGate: renders children only when the caller
 * passes authorize() (UX pre-check; RLS remains the enforcement point).
 *
 *   <PermissionGate permission="platform.member.manage" companyId={id}>…</PermissionGate>
 */
export const PermissionGate = createPermissionGate(async () =>
  createAuthorize(await createClient())
);
