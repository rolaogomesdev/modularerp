// Permission client: keys, authorize() pre-checks, PermissionGate (docs/architecture/03-permissions.md).
// Postgres remains the enforcement point; this package is UX pre-checks only.

export type PermissionScope = "own" | "team" | "company";

/** `module.resource.action`, e.g. `hr.absence.approve` — scope is carried separately. */
export type PermissionKey = `${string}.${string}.${string}`;
