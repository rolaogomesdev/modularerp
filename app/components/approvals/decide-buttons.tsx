"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Textarea } from "@repo/ui";

import {
  cancelApproval,
  decideApproval,
  type ApprovalActionState,
} from "@/lib/actions/approvals";

function ErrorLine({ state }: { state: ApprovalActionState }) {
  const t = useTranslations("approvals.errors");
  if (!state || !("errorKey" in state)) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {t(state.errorKey)}
    </p>
  );
}

export function DecideForm({
  approvalId,
  companySlug,
}: {
  approvalId: string;
  companySlug: string;
}) {
  const t = useTranslations("approvals");
  const [state, action, pending] = useActionState<ApprovalActionState, FormData>(
    decideApproval,
    null
  );
  const [showReason, setShowReason] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="approvalId" value={approvalId} />
      <input type="hidden" name="companySlug" value={companySlug} />
      {showReason ? (
        <Textarea
          name="reason"
          rows={2}
          maxLength={500}
          placeholder={t("reasonPlaceholder")}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowReason(true)}
          className="self-start text-xs text-text-muted underline-offset-4 hover:underline"
        >
          {t("addReason")}
        </button>
      )}
      <ErrorLine state={state} />
      <div className="flex gap-2">
        <Button
          type="submit"
          name="approve"
          value="approve"
          size="sm"
          disabled={pending}
        >
          {t("approve")}
        </Button>
        <Button
          type="submit"
          name="approve"
          value="reject"
          variant="outline"
          size="sm"
          disabled={pending}
        >
          {t("reject")}
        </Button>
      </div>
    </form>
  );
}

export function CancelForm({
  approvalId,
  companySlug,
}: {
  approvalId: string;
  companySlug: string;
}) {
  const t = useTranslations("approvals");
  const [state, action, pending] = useActionState<ApprovalActionState, FormData>(
    cancelApproval,
    null
  );
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="approvalId" value={approvalId} />
      <input type="hidden" name="companySlug" value={companySlug} />
      <ErrorLine state={state} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {t("cancel")}
      </Button>
    </form>
  );
}
