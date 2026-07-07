import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";

// decorative, not translatable
const CARET = "▾";

// Active company comes from the URL — no hidden tenant state (02-tenancy-and-identity.md).
export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("tenancy");
  const supabase = await createClient();

  const [{ data: company }, { data: companies }] = await Promise.all([
    supabase.from("companies").select("id, name, slug").eq("slug", slug).maybeSingle(),
    supabase.from("companies").select("id, name, slug").order("name"),
  ]);

  // RLS returns nothing for non-members — indistinguishable from not existing.
  if (!company) notFound();

  const others = (companies ?? []).filter((c) => c.id !== company.id);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        {/* Minimal switcher — replaced by the navigation shell in Phase 2 */}
        <details className="relative">
          <summary className="cursor-pointer select-none list-none font-semibold">
            {company.name}
            <span aria-hidden className="ml-1 text-text-faint">
              {CARET}
            </span>
          </summary>
          <nav className="absolute left-0 top-full z-10 mt-1 flex min-w-48 flex-col rounded-md border border-border bg-surface-raised p-1 shadow-2">
            {others.map((c) => (
              <Link
                key={c.id}
                href={`/c/${c.slug}`}
                className="rounded-sm px-3 py-2 text-sm hover:bg-accent-muted"
              >
                {c.name}
              </Link>
            ))}
            <Link
              href="/"
              className="rounded-sm px-3 py-2 text-sm text-text-muted hover:bg-accent-muted"
            >
              {t("switcher.allCompanies")}
            </Link>
          </nav>
        </details>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
