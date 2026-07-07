"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ui";

import { revokeInvitation, type ActionState } from "@/lib/actions/tenancy";

export function RevokeInviteButton({
  invitationId,
  companySlug,
}: {
  invitationId: string;
  companySlug: string;
}) {
  const t = useTranslations("tenancy");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    revokeInvitation,
    null
  );
  const errorKey = state && "errorKey" in state ? state.errorKey : null;

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="invitationId" value={invitationId} />
      <input type="hidden" name="companySlug" value={companySlug} />
      {errorKey ? (
        <span role="alert" className="text-xs text-danger">
          {t(`errors.${errorKey}`)}
        </span>
      ) : null}
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? t("common.working") : t("invite.revoke")}
      </Button>
    </form>
  );
}
