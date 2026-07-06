import type { Metadata, Viewport } from "next";
import { getLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: t("title") };
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
  // suppressHydrationWarning: data-theme is set client-side once the per-user
  // theme override ships (personal profile, Phase 2); default follows the device.
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="bg-bg font-sans text-text antialiased">{children}</body>
    </html>
  );
}
