import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getAdminContext } from "@/lib/admin-context";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { company, can } = await getAdminContext(slug);
  const t = await getTranslations("admin");

  const cards = [
    {
      show: can.manageTeams,
      href: `/c/${slug}/settings/teams`,
      title: t("nav.teams"),
      hint: t("nav.teamsHint"),
    },
    {
      show: can.manageMembers,
      href: `/c/${slug}/settings/members`,
      title: t("nav.members"),
      hint: t("nav.membersHint"),
    },
    {
      show: can.manageRoles,
      href: `/c/${slug}/settings/roles`,
      title: t("nav.roles"),
      hint: t("nav.rolesHint"),
    },
    {
      show: can.manageCustomFields,
      href: `/c/${slug}/settings/fields`,
      title: t("nav.fields"),
      hint: t("nav.fieldsHint"),
    },
  ].filter((card) => card.show);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-text-muted">
          {t("subtitle", { company: company.name })}
        </p>
        <Link
          href={`/c/${slug}`}
          className="mt-1 self-start text-sm text-accent underline-offset-4 hover:underline"
        >
          {t("back")}
        </Link>
      </header>

      <nav className="flex flex-col gap-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 shadow-1 transition-colors duration-fast hover:bg-accent-muted"
          >
            <span className="font-medium">{card.title}</span>
            <span className="text-sm text-text-muted">{card.hint}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
