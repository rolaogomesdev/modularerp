import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";

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
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  // suppressHydrationWarning: data-theme is set client-side once the per-user
  // theme override ships (personal profile, Phase 2); default follows the device.
  return (
    <html lang={locale} suppressHydrationWarning>
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
