"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, NativeSelect } from "@repo/ui";

import { setRoleGrant, type AdminActionState } from "@/lib/actions/admin";

export function RoleGrantForm({
  companyId,
  companySlug,
  roleId,
  permissionKey,
  allowedScopes,
  currentScope,
}: {
  companyId: string;
  companySlug: string;
  roleId: string;
  permissionKey: string;
  allowedScopes: string[];
  currentScope: string | null;
}) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    setRoleGrant,
    null
  );
  const errorKey = state?.errorKey ?? null;

  const scopeLabel = (scope: string) => {
    switch (scope) {
      case "own":
        return t("roles.scopeOwn");
      case "team":
        return t("roles.scopeTeam");
      case "company":
        return t("roles.scopeCompany");
      default:
        return scope;
    }
  };

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="companySlug" value={companySlug} />
      <input type="hidden" name="roleId" value={roleId} />
      <input type="hidden" name="permissionKey" value={permissionKey} />
      <div className="flex items-center gap-2">
        <NativeSelect
          name="scope"
          defaultValue={currentScope ?? "none"}
          className="w-28"
        >
          <option value="none">{t("roles.scopeNone")}</option>
          {allowedScopes.map((scope) => (
            <option key={scope} value={scope}>
              {scopeLabel(scope)}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? t("common.working") : t("common.save")}
        </Button>
      </div>
      {errorKey ? (
        <span role="alert" className="text-xs text-danger">
          {t(`errors.${errorKey}`)}
        </span>
      ) : null}
    </form>
  );
}
