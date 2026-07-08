"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Field, Input, NativeSelect } from "@repo/ui";

import { assignMembership, type AdminActionState } from "@/lib/actions/admin";

export function AssignMembershipForm({
  companyId,
  companySlug,
  members,
  teams,
  roles,
}: {
  companyId: string;
  companySlug: string;
  members: { id: string; label: string }[];
  teams: { id: string; name: string }[];
  roles: { id: string; name: string }[];
}) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    assignMembership,
    null
  );
  const errorKey = state?.errorKey ?? null;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="companySlug" value={companySlug} />

      <Field label={t("members.memberLabel")} htmlFor="assign-member">
        <NativeSelect
          id="assign-member"
          name="memberId"
          required
          defaultValue=""
        >
          <option value="" />
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field label={t("members.teamLabel")} htmlFor="assign-team">
        <NativeSelect id="assign-team" name="teamId" required defaultValue="">
          <option value="" />
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field label={t("members.roleLabel")} htmlFor="assign-role">
        <NativeSelect id="assign-role" name="roleId" required defaultValue="">
          <option value="" />
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field
        label={t("members.validToLabel")}
        htmlFor="assign-valid-to"
        help={t("members.validToHelp")}
      >
        <Input id="assign-valid-to" name="validTo" type="date" />
      </Field>

      {errorKey ? (
        <p
          role="alert"
          className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger"
        >
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}

      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? t("common.working") : t("members.submit")}
      </Button>
    </form>
  );
}
