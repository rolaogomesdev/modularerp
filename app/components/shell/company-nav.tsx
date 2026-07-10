"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCheck, House, LayoutGrid, Search } from "lucide-react";
import { BottomNav, BottomNavItem, SidebarItem } from "@repo/ui";

function useNavItems(slug: string) {
  const t = useTranslations("shell.tabs");
  const base = `/c/${slug}`;
  return [
    { href: base, label: t("home"), Icon: House, exact: true },
    { href: `${base}/modules`, label: t("modules"), Icon: LayoutGrid },
    { href: `${base}/approvals`, label: t("approvals"), Icon: CheckCheck },
    { href: `${base}/search`, label: t("search"), Icon: Search },
  ];
}

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function CompanyBottomNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const items = useNavItems(slug);
  return (
    <BottomNav>
      {items.map(({ href, label, Icon, exact }) => (
        <BottomNavItem key={href} asChild active={isActive(pathname, href, exact)}>
          <Link href={href}>
            <Icon aria-hidden />
            <span>{label}</span>
          </Link>
        </BottomNavItem>
      ))}
    </BottomNav>
  );
}

export function CompanySidebarNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const items = useNavItems(slug);
  return (
    <>
      {items.map(({ href, label, Icon, exact }) => (
        <SidebarItem key={href} asChild active={isActive(pathname, href, exact)}>
          <Link href={href}>
            <Icon aria-hidden />
            <span className="min-w-0 truncate">{label}</span>
          </Link>
        </SidebarItem>
      ))}
    </>
  );
}
