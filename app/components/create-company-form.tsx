"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Field, Input } from "@repo/ui";

import { createCompany, type ActionState } from "@/lib/actions/tenancy";

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function CreateCompanyForm() {
  const t = useTranslations("tenancy");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createCompany,
    null
  );
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const errorKey = state && "errorKey" in state ? state.errorKey : null;

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t("create.nameLabel")} htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          onChange={(e) => {
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
      </Field>
      <Field
        label={t("create.slugLabel")}
        htmlFor="slug"
        help={t("create.slugHelp", { slug: slug || "acme" })}
      >
        <Input
          id="slug"
          name="slug"
          required
          pattern="[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
        />
      </Field>

      {errorKey ? (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t("common.working") : t("create.submit")}
      </Button>
    </form>
  );
}
