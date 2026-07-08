"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { PermissionKey } from "./index";

/**
 * Client-side pre-checks: a server component computes the booleans once
 * (via createAuthorize) and hands them down; client components read them
 * synchronously. Unknown keys fail closed.
 */
const PermissionsContext = createContext<Readonly<Record<string, boolean>>>({});

export function PermissionsProvider({
  value,
  children,
}: {
  value: Readonly<Record<string, boolean>>;
  children: ReactNode;
}) {
  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermission(permission: PermissionKey): boolean {
  return useContext(PermissionsContext)[permission] ?? false;
}

export function ClientPermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return <>{usePermission(permission) ? children : fallback}</>;
}
