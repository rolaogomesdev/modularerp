"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Field, Input } from "@repo/ui";

import { createTeam, type AdminActionState } from "@/lib/actions/admin";

export function CreateTeamForm({
  companyId,
  companySlug,
}: {
  companyId: string;
  companySlug: string;
}) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    createTeam,
    null
  );
  const errorKey = state?.errorKey ?? null;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="companySlug" value={companySlug} />
      <Field label={t("teams.nameLabel")} htmlFor="team-name">
        <Input id="team-name" name="name" type="text" required maxLength={80} />
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
        {pending ? t("common.working") : t("teams.submit")}
      </Button>
    </form>
  );
}
