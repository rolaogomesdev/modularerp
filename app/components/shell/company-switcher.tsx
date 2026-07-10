"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";

type CompanyOption = { id: string; name: string; slug: string };

export function CompanySwitcher({
  companies,
  currentSlug,
}: {
  companies: CompanyOption[];
  currentSlug: string;
}) {
  const t = useTranslations("shell.switcher");
  const current = companies.find((c) => c.slug === currentSlug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${t("label")}: ${current?.name ?? ""}`}
        className="flex min-h-10 min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 font-semibold outline-none transition-colors duration-fast hover:bg-accent-muted focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <span className="min-w-0 truncate">{current?.name}</span>
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-text-faint" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {companies.map((company) => (
          <DropdownMenuItem key={company.id} asChild>
            <Link href={`/c/${company.slug}`} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{company.name}</span>
              {company.slug === currentSlug ? (
                <Check aria-hidden className="size-4 text-accent" />
              ) : null}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/" className="text-text-muted">
            {t("allCompanies")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
