"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Field, Input } from "@repo/ui";

import { authErrorKey } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrorKey(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setErrorKey(authErrorKey(error));
      setPending(false);
      return;
    }
    // Middleware routes to /2fa/challenge, /2fa/enroll or / as appropriate.
    window.location.assign("/");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("login.title")}</h1>
        <p className="text-sm text-text-muted">{t("login.subtitle")}</p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
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
        <Field label={t("fields.password")} htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
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
          {pending ? t("common.working") : t("login.submit")}
        </Button>
      </form>

      <p className="text-center text-sm text-text-muted">
        {t("login.noAccount")}{" "}
        <Link href="/signup" className="font-medium text-accent underline-offset-4 hover:underline">
          {t("login.signupLink")}
        </Link>
      </p>
    </main>
  );
}
