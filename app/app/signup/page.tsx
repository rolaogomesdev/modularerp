"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Field, Input } from "@repo/ui";

import { authErrorKey } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const t = useTranslations("auth");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrorKey(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) {
      setErrorKey(authErrorKey(error));
      setPending(false);
      return;
    }
    if (!data.session) {
      // Email confirmation enabled (staging/prod): tell the user to check their inbox.
      setConfirmEmail(true);
      setPending(false);
      return;
    }
    // Signed in at aal1 with no factor -> middleware forces /2fa/enroll.
    window.location.assign("/");
  }

  if (confirmEmail) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold">{t("signup.confirmTitle")}</h1>
        <p className="text-sm text-text-muted">{t("signup.confirmBody")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("signup.title")}</h1>
        <p className="text-sm text-text-muted">{t("signup.subtitle")}</p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label={t("fields.displayName")} htmlFor="displayName">
          <Input
            id="displayName"
            autoComplete="name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
        <Field label={t("fields.email")} htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field
          label={t("fields.password")}
          htmlFor="password"
          help={t("signup.passwordHelp")}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {errorKey ? (
          <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
            {t(`errors.${errorKey}`)}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("common.working") : t("signup.submit")}
        </Button>
      </form>

      <p className="text-center text-sm text-text-muted">
        {t("signup.haveAccount")}{" "}
        <Link href="/login" className="font-medium text-accent underline-offset-4 hover:underline">
          {t("signup.loginLink")}
        </Link>
      </p>
    </main>
  );
}
