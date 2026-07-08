import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cn } from "@repo/ui";

import { CreateRoleForm } from "@/components/admin/create-role-form";
import { RoleGrantForm } from "@/components/admin/role-grant-form";
import { getAdminContext } from "@/lib/admin-context";
import { createClient } from "@/lib/supabase/server";

type CompanyRole = {
  id: string;
  name: string;
  description: string | null;
  template_key: string | null;
};

type Permission = {
  key: string;
  module: string;
  resource: string;
  action: string;
  allowed_scopes: string[];
  is_sensitive: boolean;
  description: string | null;
};

type RoleGrant = {
  company_role_id: string;
  permission_key: string;
  scope: string;
};

export default async function RolesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ role?: string | string[] }>;
}) {
  const { slug } = await params;
  const { company, can } = await getAdminContext(slug);
  if (!can.manageRoles) notFound();

  const t = await getTranslations("admin");
  const supabase = await createClient();

  const [{ data: rolesData }, { data: permissionsData }] = await Promise.all([
    supabase
      .from("company_roles")
      .select("id, name, description, template_key")
      .eq("company_id", company.id)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("permissions")
      .select("key, module, resource, action, allowed_scopes, is_sensitive, description")
      .order("module")
      .order("key"),
  ]);

  const roles = (rolesData ?? []) as CompanyRole[];
  const permissions = (permissionsData ?? []) as Permission[];

  let grants: RoleGrant[] = [];
  if (roles.length > 0) {
    const { data: grantsData } = await supabase
      .from("role_permissions")
      .select("company_role_id, permission_key, scope")
      .in(
        "company_role_id",
        roles.map((role) => role.id)
      );
    grants = (grantsData ?? []) as RoleGrant[];
  }

  const sp = await searchParams;
  const requestedRoleId = typeof sp.role === "string" ? sp.role : undefined;
  const selected =
    roles.find((role) => role.id === requestedRoleId) ?? roles[0] ?? null;

  const scopeByPermission = new Map<string, string>();
  if (selected) {
    for (const grant of grants) {
      if (grant.company_role_id === selected.id) {
        scopeByPermission.set(grant.permission_key, grant.scope);
      }
    }
  }

  const byModule = new Map<string, Permission[]>();
  for (const permission of permissions) {
    const group = byModule.get(permission.module) ?? [];
    group.push(permission);
    byModule.set(permission.module, group);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("roles.title")}</h1>
        <Link
          href={`/c/${company.slug}`}
          className="text-sm text-text-muted underline underline-offset-4"
        >
          {t("back")}
        </Link>
      </header>

      {roles.length > 0 ? (
        <nav className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <Link
              key={role.id}
              href={`/c/${company.slug}/settings/roles?role=${role.id}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition-colors duration-fast",
                selected?.id === role.id
                  ? "bg-accent text-accent-fg"
                  : "bg-accent-muted text-text"
              )}
            >
              <span>{role.name}</span>
              {role.template_key ? (
                <span className="rounded-full border border-current px-1.5 text-xs opacity-80">
                  {t("roles.templateBadge")}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      ) : null}

      {selected ? (
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-1">
          <div className="flex flex-col gap-1">
            <h2 className="font-medium">
              {t("roles.matrixTitle", { role: selected.name })}
            </h2>
            <p className="text-sm text-text-muted">{t("roles.matrixHelp")}</p>
          </div>

          {[...byModule.entries()].map(([module, modulePermissions]) => (
            <div key={module} className="flex flex-col gap-3">
              <h3 className="text-xs uppercase tracking-wide text-text-faint">
                {module}
              </h3>
              <ul className="flex flex-col gap-3">
                {modulePermissions.map((permission) => (
                  <li
                    key={permission.key}
                    className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="text-sm">
                        {permission.description ?? permission.key}
                      </p>
                      <p className="font-mono text-xs text-text-faint">
                        {permission.key}
                      </p>
                      {permission.is_sensitive ? (
                        <span className="w-fit rounded-full bg-warning-bg px-2 py-0.5 text-xs text-warning">
                          {t("roles.sensitive")}
                        </span>
                      ) : null}
                    </div>
                    <RoleGrantForm
                      key={selected.id}
                      companyId={company.id}
                      companySlug={company.slug}
                      roleId={selected.id}
                      permissionKey={permission.key}
                      allowedScopes={permission.allowed_scopes}
                      currentScope={scopeByPermission.get(permission.key) ?? null}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1">
        <h2 className="font-medium">{t("roles.createTitle")}</h2>
        <CreateRoleForm companyId={company.id} companySlug={company.slug} />
      </section>
    </main>
  );
}
