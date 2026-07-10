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
import { Settings } from "lucide-react";

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
  const supabase = await createClient();

  const [{ data: company }, { data: companies }] = await Promise.all([
    supabase.from("companies").select("id, name, slug").eq("slug", slug).maybeSingle(),
    supabase.from("companies").select("id, name, slug").order("name"),
  ]);

  // RLS returns nothing for non-members — indistinguishable from not existing.
  if (!company) notFound();

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
          <form action="/auth/signout" method="post">
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start text-text-faint"
            >
              {t("signOut")}
            </Button>
          </form>
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
            <NotificationsBell />
            {settingsLink}
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
