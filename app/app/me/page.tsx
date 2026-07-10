import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@repo/ui";

import { AvatarUploader } from "@/components/me/avatar-uploader";
import {
  IdentityForm,
  NotificationsForm,
  PreferencesForm,
} from "@/components/me/profile-forms";
import {
  ChangePasswordForm,
  SignOutOtherSessions,
  TwoFactorDevices,
} from "@/components/me/security-forms";
import { createClient } from "@/lib/supabase/server";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-1">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  );
}

// The personal profile: account-global, owned by the person — never by a
// company (02-tenancy-and-identity.md).
export default async function MePage() {
  const t = await getTranslations("profile");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, locale, theme, notification_prefs")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) notFound();

  const prefs = (profile.notification_prefs ?? {}) as {
    approvals?: boolean;
    digest?: boolean;
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 pb-16">
      <PageHeader title={t("title")} description={user.email ?? undefined} />
      <Link
        href="/"
        className="-mt-4 self-start text-sm text-text-muted underline-offset-4 hover:underline"
      >
        {t("back")}
      </Link>

      <Section title={t("identity.title")}>
        <AvatarUploader
          userId={user.id}
          avatarUrl={profile.avatar_url}
          displayName={profile.display_name}
        />
        <IdentityForm displayName={profile.display_name} />
      </Section>

      <Section title={t("preferences.title")}>
        <PreferencesForm locale={profile.locale} theme={profile.theme} />
      </Section>

      <Section title={t("notifications.title")}>
        <NotificationsForm prefs={prefs} />
      </Section>

      <Section title={t("security.title")}>
        <ChangePasswordForm />
        <hr className="border-border" />
        <h3 className="text-sm font-medium">{t("security.devicesTitle")}</h3>
        <TwoFactorDevices />
        <hr className="border-border" />
        <h3 className="text-sm font-medium">{t("security.sessionsTitle")}</h3>
        <SignOutOtherSessions />
      </Section>
    </main>
  );
}
