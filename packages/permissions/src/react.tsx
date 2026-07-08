import type { ReactNode } from "react";

import type { AuthorizeArgs, AuthorizeFn } from "./index";

export type PermissionGateProps = AuthorizeArgs & {
  children: ReactNode;
  /** rendered when the check fails (default: nothing) */
  fallback?: ReactNode;
};

/**
 * Builds the server-component PermissionGate (09-design-system.md): renders
 * children or nothing/fallback. The host app supplies how to authorize
 * (per-request client creation stays app-side).
 */
export function createPermissionGate(
  getAuthorize: () => Promise<AuthorizeFn> | AuthorizeFn
) {
  return async function PermissionGate({
    children,
    fallback = null,
    ...args
  }: PermissionGateProps) {
    const authorize = await getAuthorize();
    const allowed = await authorize(args);
    return <>{allowed ? children : fallback}</>;
  };
}
