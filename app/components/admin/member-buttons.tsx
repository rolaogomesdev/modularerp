"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ui";

import {
  reactivateMember,
  removeMembership,
  suspendMember,
  type AdminActionState,
} from "@/lib/actions/admin";

export function MemberStatusButton({
  companyId,
  companySlug,
  memberId,
  suspended,
}: {
  companyId: string;
  companySlug: string;
  memberId: string;
  suspended: boolean;
}) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    suspended ? reactivateMember : suspendMember,
    null
  );
  const errorKey = state?.errorKey ?? null;

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="companySlug" value={companySlug} />
      <input type="hidden" name="memberId" value={memberId} />
      {errorKey ? (
        <span role="alert" className="text-xs text-danger">
          {t(`errors.${errorKey}`)}
        </span>
      ) : null}
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending
          ? t("common.working")
          : suspended
            ? t("members.reactivate")
            : t("members.suspend")}
      </Button>
    </form>
  );
}

export function RemoveMembershipButton({
  companyId,
  companySlug,
  membershipId,
}: {
  companyId: string;
  companySlug: string;
  membershipId: string;
}) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    removeMembership,
    null
  );
  const errorKey = state?.errorKey ?? null;

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="companySlug" value={companySlug} />
      <input type="hidden" name="membershipId" value={membershipId} />
      {errorKey ? (
        <span role="alert" className="text-xs text-danger">
          {t(`errors.${errorKey}`)}
        </span>
      ) : null}
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? t("common.working") : t("members.remove")}
      </Button>
    </form>
  );
}
