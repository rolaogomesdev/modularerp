import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { authorizeAny, createAuthorize } from "@repo/permissions";
import {
  Button,
  buttonVariants,
  cn,
  OfflineBanner,
  Sidebar,
  TopBar,
} from "@repo/ui";
import { CircleHelp, Settings, UserRound } from "lucide-react";

import { AssistantStub } from "@/components/shell/assistant-stub";
import {
  CompanyBottomNav,
  CompanySidebarNav,
} from "@/components/shell/company-nav";
import { CompanySwitcher } from "@/components/shell/company-switcher";
import { NotificationsBell } from "@/components/shell/notifications-bell";
import { createClient } from "@/lib/supabase/server";

// Active company comes from the URL — no hidden tenant state (02-tenancy-and-identity.md).
export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("shell");
  const tAdmin = await getTranslations("admin");
  const tProfile = await getTranslations("profile");
  const tHelp = await getTranslations("help");
  const supabase = await createClient();

  const [{ data: company }, { data: companies }, { data: user }] =
    await Promise.all([
      supabase.from("companies").select("id, name, slug").eq("slug", slug).maybeSingle(),
      supabase.from("companies").select("id, name, slug").order("name"),
      supabase.auth.getUser().then((r) => ({ data: r.data.user })),
    ]);

  // RLS returns nothing for non-members — indistinguishable from not existing.
  if (!company) notFound();

  // recent notifications for this recipient in THIS company (RLS also scopes
  // to their own rows; the company filter keeps the bell context-relevant)
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, kind, params, href, read_at, created_at")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const authorize = createAuthorize(supabase);
  const canAdmin = await authorizeAny(authorize, company.id, [
    "platform.member.manage",
    "platform.team.manage",
    "platform.role.manage",
  ]);

  const settingsLink = canAdmin ? (
    <Link
      href={`/c/${company.slug}/settings`}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "text-text-muted"
      )}
      aria-label={tAdmin("title")}
    >
      <Settings aria-hidden className="size-5" />
    </Link>
  ) : null;

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        header={
          <CompanySwitcher
            companies={companies ?? []}
            currentSlug={company.slug}
          />
        }
        footer={
          <div className="flex flex-col gap-1">
            <Link
              href="/help"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "w-full justify-start text-text-muted"
              )}
            >
              <CircleHelp aria-hidden className="size-4" />
              {tHelp("title")}
            </Link>
            <Link
              href="/me"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "w-full justify-start text-text-muted"
              )}
            >
              <UserRound aria-hidden className="size-4" />
              {tProfile("title")}
            </Link>
            <form action="/auth/signout" method="post">
              <Button
                type="submit"
                variant="ghost"
                className="w-full justify-start text-text-faint"
              >
                {t("signOut")}
              </Button>
            </form>
          </div>
        }
      >
        <CompanySidebarNav slug={company.slug} />
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner label={t("offline")} />
        <TopBar className="lg:justify-end">
          <div className="min-w-0 flex-1 lg:hidden">
            <CompanySwitcher
              companies={companies ?? []}
              currentSlug={company.slug}
            />
          </div>
          <div className="flex items-center gap-1">
            {user ? (
              <NotificationsBell
                key={company.id}
                userId={user.id}
                companyId={company.id}
                initial={notifications ?? []}
              />
            ) : null}
            {settingsLink}
            <Link
              href="/help"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "text-text-muted"
              )}
              aria-label={tHelp("title")}
            >
              <CircleHelp aria-hidden className="size-5" />
            </Link>
            <Link
              href="/me"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "text-text-muted"
              )}
              aria-label={tProfile("title")}
            >
              <UserRound aria-hidden className="size-5" />
            </Link>
          </div>
        </TopBar>

        {/* pb clears the mobile tab bar; the FAB may overlap trailing
            right-edge content (standard FAB convention) */}
        <div className="flex-1 pb-28 lg:pb-8">{children}</div>
      </div>

      <CompanyBottomNav slug={company.slug} />
      <AssistantStub />
    </div>
  );
}
