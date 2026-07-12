"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Field, Input } from "@repo/ui";

import {
  adminCreateCompany,
  type PlatformActionState,
} from "@/lib/actions/platform";
import { SLUG_PATTERN, slugify } from "@/lib/slug";

export function ProvisionForm() {
  const t = useTranslations("platform");
  const [state, action, pending] = useActionState<PlatformActionState, FormData>(
    adminCreateCompany,
    null
  );
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const errorKey = state && "errorKey" in state ? state.errorKey : null;
  const created = state && "slug" in state ? state : null;

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <Field label={t("provision.nameLabel")} htmlFor="prov-name">
          <Input
            id="prov-name"
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
          label={t("provision.slugLabel")}
          htmlFor="prov-slug"
          help={t("provision.slugHelp", { slug: slug || t("provision.slugExample") })}
        >
          <Input
            id="prov-slug"
            name="slug"
            required
            pattern={SLUG_PATTERN}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
        </Field>
        <Field
          label={t("provision.ownerEmailLabel")}
          htmlFor="prov-email"
          help={t("provision.ownerEmailHelp")}
        >
          <Input id="prov-email" name="ownerEmail" type="email" required />
        </Field>

        {errorKey ? (
          <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
            {t(`errors.${errorKey}`)}
          </p>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? t("working") : t("provision.submit")}
        </Button>
      </form>

      {created ? <OwnerInviteLink token={created.inviteToken} /> : null}
    </div>
  );
}

function OwnerInviteLink({ token }: { token: string }) {
  const t = useTranslations("platform");
  // SSR-safe (progressive enhancement re-renders this on the server): show the
  // path, prepend the origin only in the browser.
  const path = `/join/${token}`;
  const link = typeof window === "undefined" ? path : `${window.location.origin}${path}`;
  return (
    <div className="flex flex-col gap-2 rounded-md bg-success-bg p-3">
      <p className="text-sm text-success">{t("provision.created")}</p>
      <code className="break-all rounded-sm bg-surface px-2 py-1 text-xs text-text">
        {link}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => navigator.clipboard.writeText(link)}
      >
        {t("provision.copy")}
      </Button>
    </div>
  );
}
