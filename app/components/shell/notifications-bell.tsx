"use client";

import { useTranslations } from "next-intl";
import { Bell, Inbox } from "lucide-react";
import {
  EmptyState,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui";

/** Stub until the notifications primitive lands — the bell is the contract. */
export function NotificationsBell() {
  const t = useTranslations("shell.notifications");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton aria-label={t("open")} variant="ghost">
          <Bell aria-hidden className="size-5" />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b border-border px-4 py-3 text-sm font-medium">
          {t("title")}
        </p>
        <EmptyState
          icon={<Inbox aria-hidden className="size-5" />}
          title={t("empty")}
          className="border-0 shadow-none"
        />
      </PopoverContent>
    </Popover>
  );
}
