"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, Field, Input, NativeSelect } from "@repo/ui";

import { CustomFieldsSection } from "@/components/custom-fields/custom-field-input";
import { type CustomFieldDef } from "@/lib/custom-fields";
import { submitLeaveRequest, type LeaveActionState } from "@/lib/actions/leave";
import { LEAVE_TYPES } from "@/lib/leave";

export function LeaveForm({
  companyId,
  companySlug,
  customDefs,
}: {
  companyId: string;
  companySlug: string;
  customDefs: CustomFieldDef[];
}) {
  const t = useTranslations("leave");
  const [state, action, pending] = useActionState<LeaveActionState, FormData>(
    submitLeaveRequest,
    null
  );
  const errorKey = state?.errorKey ?? null;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="companySlug" value={companySlug} />

      <Field label={t("type")} htmlFor="leave-type">
        <NativeSelect id="leave-type" name="leaveType" required defaultValue="">
          <option value="" disabled />
          {LEAVE_TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t(`types.${ty}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("startDate")} htmlFor="leave-start">
          <Input id="leave-start" name="startDate" type="date" required />
        </Field>
        <Field label={t("endDate")} htmlFor="leave-end">
          <Input id="leave-end" name="endDate" type="date" required />
        </Field>
      </div>

      <Field label={t("reason")} htmlFor="leave-reason" help={t("reasonHelp")}>
        <Input id="leave-reason" name="reason" maxLength={2000} />
      </Field>

      <CustomFieldsSection defs={customDefs} />

      {errorKey ? (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("working") : t("submit")}
      </Button>
    </form>
  );
}
