"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ui";

import { acceptInvitation, type ActionState } from "@/lib/actions/tenancy";

export function AcceptInviteForm({ token }: { token: string }) {
  const t = useTranslations("tenancy");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    acceptInvitation,
    null
  );
  const errorKey = state && "errorKey" in state ? state.errorKey : null;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      {errorKey ? (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t("common.working") : t("join.accept")}
      </Button>
    </form>
  );
}
