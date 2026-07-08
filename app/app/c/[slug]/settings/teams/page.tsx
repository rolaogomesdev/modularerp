import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CreateTeamForm } from "@/components/admin/create-team-form";
import { getAdminContext } from "@/lib/admin-context";
import { createClient } from "@/lib/supabase/server";

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { company, can } = await getAdminContext(slug);
  if (!can.manageTeams) notFound();

  const t = await getTranslations("admin");
  const supabase = await createClient();

  const [{ data: teams }, { data: memberships }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, created_at")
      .eq("company_id", company.id)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("team_memberships")
      .select("team_id")
      .eq("company_id", company.id),
  ]);

  const countByTeam = new Map<string, number>();
  for (const membership of memberships ?? []) {
    countByTeam.set(
      membership.team_id,
      (countByTeam.get(membership.team_id) ?? 0) + 1
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("teams.title")}</h1>
        <Link
          href={`/c/${company.slug}/settings`}
          className="text-sm text-text-muted underline"
        >
          {t("back")}
        </Link>
      </header>

      {teams && teams.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {teams.map((team) => (
            <li
              key={team.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3 shadow-1"
            >
              <span className="min-w-0 truncate text-sm font-medium">
                {team.name}
              </span>
              <span className="shrink-0 text-xs text-text-muted">
                {t("teams.membershipCount", {
                  count: countByTeam.get(team.id) ?? 0,
                })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted shadow-1">
          {t("teams.empty")}
        </p>
      )}

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1">
        <h2 className="font-medium">{t("teams.createTitle")}</h2>
        <CreateTeamForm companyId={company.id} companySlug={company.slug} />
      </section>
    </main>
  );
}
