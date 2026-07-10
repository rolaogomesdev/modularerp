"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Field,
  Input,
  NativeSelect,
  RadioGroup,
  RadioGroupItem,
  Label,
  Switch,
} from "@repo/ui";
import { locales } from "@repo/i18n";

import {
  updateIdentity,
  updateNotificationPrefs,
  updatePreferences,
  type ProfileActionState,
} from "@/lib/actions/profile";

function Feedback({ state }: { state: ProfileActionState }) {
  const t = useTranslations("profile");
  if (state && "errorKey" in state) {
    return (
      <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
        {t(`errors.${state.errorKey}`)}
      </p>
    );
  }
  if (state && "saved" in state) {
    return (
      <p role="status" className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
        {t("saved")}
      </p>
    );
  }
  return null;
}

export function IdentityForm({ displayName }: { displayName: string }) {
  const t = useTranslations("profile");
  const [state, action, pending] = useActionState<ProfileActionState, FormData>(
    updateIdentity,
    null
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t("identity.nameLabel")} htmlFor="displayName">
        <Input
          id="displayName"
          name="displayName"
          defaultValue={displayName}
          required
          maxLength={80}
        />
      </Field>
      <Feedback state={state} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("working") : t("save")}
      </Button>
    </form>
  );
}

export function PreferencesForm({
  locale,
  theme,
}: {
  locale: string;
  theme: string;
}) {
  const t = useTranslations("profile");
  const [state, action, pending] = useActionState<ProfileActionState, FormData>(
    updatePreferences,
    null
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t("preferences.languageLabel")} htmlFor="locale">
        <NativeSelect id="locale" name="locale" defaultValue={locale}>
          {locales.map((code) => (
            <option key={code} value={code}>
              {t(`preferences.locales.${code}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-text">
          {t("preferences.themeLabel")}
        </legend>
        <RadioGroup name="theme" defaultValue={theme} className="flex flex-col gap-2">
          {(["system", "light", "dark"] as const).map((value) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem id={`theme-${value}`} value={value} />
              <Label htmlFor={`theme-${value}`}>
                {t(`preferences.themes.${value}`)}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>

      <Feedback state={state} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("working") : t("save")}
      </Button>
    </form>
  );
}

export function NotificationsForm({
  prefs,
}: {
  prefs: { approvals?: boolean; digest?: boolean };
}) {
  const t = useTranslations("profile");
  const [state, action, pending] = useActionState<ProfileActionState, FormData>(
    updateNotificationPrefs,
    null
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="pref-approvals">{t("notifications.approvals")}</Label>
        <Switch
          id="pref-approvals"
          name="approvals"
          defaultChecked={prefs.approvals ?? true}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="pref-digest">{t("notifications.digest")}</Label>
        <Switch id="pref-digest" name="digest" defaultChecked={prefs.digest ?? false} />
      </div>
      <p className="text-xs text-text-faint">{t("notifications.note")}</p>
      <Feedback state={state} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("working") : t("save")}
      </Button>
    </form>
  );
}
