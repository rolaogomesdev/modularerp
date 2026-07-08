// Permission client (docs/architecture/03-permissions.md).
// UX pre-checks ONLY — Postgres RLS via authorize() is the enforcement point.

export type PermissionScope = "own" | "team" | "company";

/** `module.resource.action`, e.g. `hr.absence.approve` — scope is carried separately. */
export type PermissionKey = `${string}.${string}.${string}`;

export type AuthorizeArgs = {
  permission: PermissionKey;
  companyId: string;
  /** team the TARGET ROW belongs to (scope 'team' checks) */
  teamId?: string | null;
  /** user the TARGET ROW is about (scope 'own' checks) */
  ownerId?: string | null;
};

export type AuthorizeFn = (args: AuthorizeArgs) => Promise<boolean>;

/** Minimal structural view of a supabase-js client — keeps this package dependency-free. */
export type RpcClient = {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/**
 * Wraps a Supabase client (server or browser) into a cached authorize().
 * Create one per request/render — the cache lives as long as the instance,
 * so repeated checks (nav + page + gates) cost one RPC each at most.
 * Fails closed: RPC errors resolve to false.
 */
export function createAuthorize(client: RpcClient): AuthorizeFn {
  const cache = new Map<string, Promise<boolean>>();

  return ({ permission, companyId, teamId = null, ownerId = null }) => {
    const key = `${permission}|${companyId}|${teamId ?? ""}|${ownerId ?? ""}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = Promise.resolve(
        client.rpc("authorize", {
          p_permission: permission,
          p_company: companyId,
          p_team: teamId,
          p_owner: ownerId,
        })
      ).then(
        ({ data, error }) => !error && data === true,
        () => false
      );
      cache.set(key, pending);
    }
    return pending;
  };
}

/** Convenience: check several permissions at once (e.g. "show settings link?"). */
export async function authorizeAny(
  authorize: AuthorizeFn,
  companyId: string,
  permissions: PermissionKey[]
): Promise<boolean> {
  const results = await Promise.all(
    permissions.map((permission) => authorize({ permission, companyId }))
  );
  return results.some(Boolean);
}
