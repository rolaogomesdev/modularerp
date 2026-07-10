import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";

import { createClient } from "@/lib/supabase/server";
import { THEME_COOKIE } from "@/lib/theme";

/** cookie-first (instant), profile fallback (cross-device source of truth) */
async function resolveTheme(): Promise<"light" | "dark" | undefined> {
  const cookieTheme = (await cookies()).get(THEME_COOKIE)?.value;
  if (cookieTheme === "light" || cookieTheme === "dark") return cookieTheme;
  if (cookieTheme === "system") return undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return undefined;
  const { data: profile } = await supabase
    .from("profiles")
    .select("theme")
    .eq("id", user.id)
    .maybeSingle();
  const theme = profile?.theme;
  return theme === "light" || theme === "dark" ? theme : undefined;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: t("title"),
    icons: { apple: "/icon-192.png" },
    // iOS treats installed web apps separately from the manifest
    appleWebApp: { capable: true, title: t("title") },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // without this, env(safe-area-inset-*) is 0 and pb-safe no-ops on iOS
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const theme = await resolveTheme();
  // data-theme absent = follow the device (tokens' media query handles it)
  return (
    <html lang={locale} data-theme={theme} suppressHydrationWarning>
      <body className="bg-bg font-sans text-text antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
        {/* no-op outside Vercel */}
        <Analytics />
      </body>
    </html>
  );
}
