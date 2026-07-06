import type { Metadata, Viewport } from "next";
import "./globals.css";

// TODO(phase-0): lang comes from next-intl once wired; title from app config, not a hard-coded brand.
export const metadata: Metadata = {
  title: "ERP",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning: data-theme is set client-side once the per-user
  // theme override ships (personal profile, Phase 2); default follows the device.
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-bg font-sans text-text antialiased">{children}</body>
    </html>
  );
}
