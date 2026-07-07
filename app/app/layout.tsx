import type { Metadata, Viewport } from "next";

// TODO(phase-0): lang comes from next-intl once wired; title from app config, not a hard-coded brand.
export const metadata: Metadata = {
  title: "ERP",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
