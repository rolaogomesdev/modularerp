import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AcceptInviteForm } from "@/components/accept-invite-form";
import { CreateCompanyForm } from "@/components/create-company-form";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const t = await getTranslations("tenancy");
  const tProfile = await getTranslations("profile");
  const supabase = await createClient();
  const [{ data: companies }, { data: invitations }] = await Promise.all([
    supabase.from("companies").select("id, name, slug").order("name"),
    supabase.rpc("my_invitations") as unknown as Promise<{
      data:
        | { invite_token: string; company_name: string; invited_at: string }[]
        | null;
    }>,
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 p-6">
      <header className="flex items-start justify-between gap-3 pt-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("home.title")}</h1>
          <p className="text-sm text-text-muted">{t("home.subtitle")}</p>
        </div>
        <Link
          href="/me"
          className="text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          {tProfile("title")}
        </Link>
      </header>

      {invitations && invitations.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-text-muted">
            {t("invitations.title")}
          </h2>
          <ul className="flex flex-col gap-2">
            {invitations.map((invitation) => (
              <li
                key={invitation.invite_token}
                className="flex items-center justify-between gap-3 rounded-lg border border-accent bg-accent-muted p-4"
              >
                <span className="font-medium">{invitation.company_name}</span>
                <AcceptInviteForm token={invitation.invite_token} compact />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {companies && companies.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-text-muted">
            {t("home.yourCompanies")}
          </h2>
          <ul className="flex flex-col gap-2">
            {companies.map((company) => {
              const displayPath = `/${company.slug}`;
              return (
                <li key={company.id}>
                  <Link
                    href={`/c/${company.slug}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface p-4 shadow-1 transition-colors duration-fast hover:bg-accent-muted"
                  >
                    <span className="font-medium">{company.name}</span>
                    <span className="text-sm text-text-faint">{displayPath}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted shadow-1">
          {t("home.empty")}
        </p>
      )}

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1">
        <h2 className="font-medium">{t("home.createTitle")}</h2>
        <CreateCompanyForm />
      </section>

      <form action="/auth/signout" method="post" className="pb-6 text-center">
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
