"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Field, Input } from "@repo/ui";

import { createClient } from "@/lib/supabase/client";

export default function EnrollPage() {
  const t = useTranslations("auth");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      // Abandoned enrollments leave unverified factors behind — clear them first.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const factor of factors?.all ?? []) {
        if (factor.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }
      const { data } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        // unique per device — GoTrue rejects duplicate friendly names
        friendlyName: `totp-${Date.now()}`,
      });
      if (data) {
        setFactorId(data.id);
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
      }
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
    // Session is now aal2.
    window.location.assign("/");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("enroll.title")}</h1>
        <p className="text-sm text-text-muted">{t("enroll.subtitle")}</p>
      </header>

      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-text-muted">
        <li>{t("enroll.step1")}</li>
        <li>{t("enroll.step2")}</li>
        <li>{t("enroll.step3")}</li>
      </ol>

      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-1">
        {qrCode ? (
          // Supabase returns the QR as an SVG data URL.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrCode}
            alt={t("enroll.qrAlt")}
            width={192}
            height={192}
            className="rounded-md bg-surface-scan p-2"
          />
        ) : (
          <div
            aria-hidden
            className="size-48 animate-pulse rounded-md bg-accent-muted"
          />
        )}
        {secret ? (
          <p className="max-w-full break-all text-center font-mono text-xs text-text-faint">
            {secret}
          </p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label={t("fields.totpCode")} htmlFor="code">
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
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
          {pending ? t("common.working") : t("enroll.submit")}
        </Button>
      </form>

      <p className="text-center text-sm text-text-muted">{t("enroll.recoveryNote")}</p>

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
