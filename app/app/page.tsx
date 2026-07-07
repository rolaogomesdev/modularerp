import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";

// TODO(phase-0): becomes the "create a company or accept an invitation" shell
// with the tenancy item; for now it proves the authenticated AAL2 state.
export default async function HomePage() {
  const t = await getTranslations("home");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-text-muted">
          {t("signedInAs", { email: user?.email ?? "" })}
        </p>
      </header>

      <section className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted shadow-1">
        {t("nextUp")}
      </section>

      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="text-sm text-text-faint underline-offset-4 hover:underline"
        >
          {t("signOut")}
        </button>
      </form>
    </main>
  );
}
