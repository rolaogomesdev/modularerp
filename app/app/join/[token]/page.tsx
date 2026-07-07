import { getTranslations } from "next-intl/server";

import { AcceptInviteForm } from "@/components/accept-invite-form";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("tenancy");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold">{t("join.title")}</h1>
        <p className="text-sm text-text-muted">{t("join.subtitle")}</p>
      </header>
      <AcceptInviteForm token={token} />
    </main>
  );
}
