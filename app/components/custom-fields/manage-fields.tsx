"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Field, Input, NativeSelect, Switch } from "@repo/ui";

import {
  createCustomField,
  setCustomFieldArchived,
  type FieldActionState,
} from "@/lib/actions/custom-fields";
import {
  CUSTOM_FIELD_TYPES,
  CUSTOMIZABLE_ENTITIES,
} from "@/lib/custom-fields";

export function CreateFieldForm({
  companyId,
  companySlug,
}: {
  companyId: string;
  companySlug: string;
}) {
  const t = useTranslations("customFields");
  const [state, action, pending] = useActionState<FieldActionState, FormData>(
    createCustomField,
    null
  );
  const [type, setType] = useState<string>("text");
  const errorKey = state && "errorKey" in state ? state.errorKey : null;
  const showOptions = type === "select" || type === "multi_select";

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="companySlug" value={companySlug} />

      <Field label={t("entity")} htmlFor="cf-entity">
        <NativeSelect id="cf-entity" name="entity" required defaultValue="">
          <option value="" disabled />
          {CUSTOMIZABLE_ENTITIES.map((e) => (
            <option key={e} value={e}>
              {t(`entities.${e}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("labelEn")} htmlFor="cf-label-en">
          <Input id="cf-label-en" name="labelEn" required maxLength={60} />
        </Field>
        <Field label={t("labelPt")} htmlFor="cf-label-pt">
          <Input id="cf-label-pt" name="labelPt" required maxLength={60} />
        </Field>
      </div>

      <Field label={t("key")} htmlFor="cf-key" help={t("keyHelp")}>
        <Input
          id="cf-key"
          name="key"
          required
          maxLength={40}
          pattern="[a-z][a-z0-9_]*"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("type")} htmlFor="cf-type">
          <NativeSelect
            id="cf-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {CUSTOM_FIELD_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`types.${ty}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="flex items-end justify-between gap-3">
          <label htmlFor="cf-required" className="text-sm font-medium text-text">
            {t("required")}
          </label>
          <Switch id="cf-required" name="required" />
        </div>
      </div>

      {showOptions ? (
        <Field label={t("options")} htmlFor="cf-options" help={t("optionsHelp")}>
          <Input id="cf-options" name="options" maxLength={500} />
        </Field>
      ) : null}

      {errorKey ? (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("working") : t("create")}
      </Button>
    </form>
  );
}

export function ArchiveFieldButton({
  id,
  companyId,
  companySlug,
  archived,
}: {
  id: string;
  companyId: string;
  companySlug: string;
  archived: boolean;
}) {
  const t = useTranslations("customFields");
  const [, action, pending] = useActionState<FieldActionState, FormData>(
    setCustomFieldArchived,
    null
  );
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="companySlug" value={companySlug} />
      <input type="hidden" name="archived" value={archived ? "false" : "true"} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {archived ? t("restore") : t("archive")}
      </Button>
    </form>
  );
}
