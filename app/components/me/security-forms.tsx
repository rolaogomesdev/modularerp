"use client";

import * as React from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { Factor } from "@supabase/supabase-js";
import { Button, Field, Input, ListItem, Skeleton } from "@repo/ui";

import { authErrorKey } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

// machine-generated uniqueness suffix, never meant for humans
const GENERATED_NAME = /^totp-\d+$/;

export function ChangePasswordForm() {
  const t = useTranslations("profile.security");
  const tAuth = useTranslations("auth");
  const [pending, setPending] = React.useState(false);
  const [errorKey, setErrorKey] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = new FormData(form).get("newPassword");
    setSaved(false);
    if (typeof password !== "string" || password.length < 8) {
      setErrorKey("weak_password");
      return;
    }
    setPending(true);
    setErrorKey(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setErrorKey(authErrorKey(error));
    else {
      setSaved(true);
      form.reset();
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field
        label={t("newPassword")}
        htmlFor="newPassword"
        help={t("passwordHelp")}
      >
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      {errorKey ? (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {tAuth(`errors.${errorKey}`)}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
          {t("passwordSaved")}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t("working") : t("changePassword")}
      </Button>
    </form>
  );
}

export function TwoFactorDevices() {
  const t = useTranslations("profile.security");
  const format = useFormatter();
  const [factors, setFactors] = React.useState<Factor[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      if (!cancelled) setFactors(data?.totp ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(factorId: string) {
    setBusyId(factorId);
    setFailed(false);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      setFailed(true);
      setBusyId(null);
      return;
    }
    // refresh so the AAL downgrade lands in the JWT immediately — removing
    // the last device then routes straight into re-enrollment (new phone flow)
    await supabase.auth.refreshSession();
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-3">
      {factors === null ? (
        <Skeleton className="h-14" />
      ) : (
        <ul className="flex flex-col gap-2">
          {factors.map((factor) => (
            <li key={factor.id}>
              <ListItem
                title={
                  factor.friendly_name && !GENERATED_NAME.test(factor.friendly_name)
                    ? factor.friendly_name
                    : t("unnamedDevice")
                }
                subtitle={format.dateTime(new Date(factor.created_at), {
                  dateStyle: "medium",
                })}
                meta={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busyId === factor.id}
                    onClick={() => remove(factor.id)}
                  >
                    {t("removeDevice")}
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}
      {failed ? (
        <p role="alert" className="text-sm text-danger">
          {t("removeFailed")}
        </p>
      ) : null}
      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/2fa/enroll">{t("addDevice")}</Link>
        </Button>
      </div>
      <p className="text-xs text-text-faint">{t("deviceNote")}</p>
    </div>
  );
}

export function SignOutOtherSessions() {
  const t = useTranslations("profile.security");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  async function onClick() {
    setPending(true);
    setFailed(false);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) setFailed(true);
    else setDone(true);
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending || done}
        onClick={onClick}
        className="self-start"
      >
        {done ? t("otherSessionsDone") : pending ? t("working") : t("signOutOthers")}
      </Button>
      {failed ? (
        <p role="alert" className="text-sm text-danger">
          {t("otherSessionsFailed")}
        </p>
      ) : null}
      <p className="text-xs text-text-faint">{t("signOutOthersNote")}</p>
    </div>
  );
}
