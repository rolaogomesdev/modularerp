"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Field, Input } from "@repo/ui";

import { inviteMember, type ActionState } from "@/lib/actions/tenancy";

export function InviteForm({ companyId }: { companyId: string }) {
  const t = useTranslations("tenancy");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    inviteMember,
    null
  );
  const errorKey = state && "errorKey" in state ? state.errorKey : null;
  const token = state && "token" in state ? state.token : null;

  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="companyId" value={companyId} />
        <Field
          label={t("invite.emailLabel")}
          htmlFor="invite-email"
          help={t("invite.emailHelp")}
        >
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder={t("invite.emailPlaceholder")}
          />
        </Field>

        {errorKey ? (
          <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
            {t(`errors.${errorKey}`)}
          </p>
        ) : null}

        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? t("common.working") : t("invite.submit")}
        </Button>
      </form>

      {token ? <InviteLink token={token} /> : null}
    </div>
  );
}

function InviteLink({ token }: { token: string }) {
  const t = useTranslations("tenancy");
  const link = `${window.location.origin}/join/${token}`;
  return (
    <div className="flex flex-col gap-2 rounded-md bg-success-bg p-3">
      <p className="text-sm text-success">{t("invite.created")}</p>
      <code className="break-all rounded-sm bg-surface px-2 py-1 text-xs text-text">
        {link}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => navigator.clipboard.writeText(link)}
      >
        {t("invite.copy")}
      </Button>
    </div>
  );
}
