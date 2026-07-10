"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Field, Input } from "@repo/ui";

import { createClient } from "@/lib/supabase/client";

export default function ChallengePage() {
  const t = useTranslations("auth");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.[0];
      if (totp) setFactorId(totp.id);
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setPending(true);
    setFailed(false);
    const supabase = createClient();
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
    if (!challenge) {
      setFailed(true);
      setPending(false);
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (error) {
      setFailed(true);
      setPending(false);
      return;
    }
    window.location.assign("/");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("challenge.title")}</h1>
        <p className="text-sm text-text-muted">{t("challenge.subtitle")}</p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label={t("fields.totpCode")} htmlFor="code">
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="text-center font-mono text-xl tracking-widest"
          />
        </Field>

        {failed ? (
          <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
            {t("errors.mfa_verification_failed")}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={pending || !factorId || code.length !== 6}
          className="w-full"
        >
          {pending ? t("common.working") : t("challenge.submit")}
        </Button>
      </form>

      <p className="text-center text-sm text-text-muted">{t("challenge.lostDevice")}</p>

      <form action="/auth/signout" method="post" className="text-center">
        <button
          type="submit"
          className="text-sm text-text-faint underline-offset-4 hover:underline"
        >
          {t("common.signOut")}
        </button>
      </form>
    </main>
  );
}
