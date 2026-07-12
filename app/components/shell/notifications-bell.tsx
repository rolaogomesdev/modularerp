"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, Inbox } from "lucide-react";
import {
  Button,
  EmptyState,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui";

import { markNotificationsRead, type NotificationRow } from "@/lib/actions/notifications";
import { createClient } from "@/lib/supabase/client";

function useNotifications(
  userId: string,
  companyId: string,
  initial: NotificationRow[]
) {
  // remounted per company via key={companyId} in the layout, so initial is fresh
  const [items, setItems] = React.useState(initial);

  React.useEffect(() => {
    const supabase = createClient();
    // postgres_changes filters on one column; scope to the recipient and
    // filter to the current company client-side (payload carries company_id).
    const channel = supabase
      .channel(`notifications:${userId}:${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow & { company_id: string };
          if (row.company_id !== companyId) return;
          setItems((prev) =>
            prev.some((n) => n.id === row.id) ? prev : [row, ...prev].slice(0, 20)
          );
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, companyId]);

  return [items, setItems] as const;
}

export function NotificationsBell({
  userId,
  companyId,
  initial,
}: {
  userId: string;
  companyId: string;
  initial: NotificationRow[];
}) {
  const t = useTranslations("shell.notifications");
  const router = useRouter();
  const [items, setItems] = useNotifications(userId, companyId, initial);
  const unread = items.filter((n) => n.read_at === null).length;

  function labelFor(n: NotificationRow) {
    const key = `kinds.${n.kind}`;
    return t.has(key)
      ? t(key, n.params as Record<string, string>)
      : t("kinds.generic");
  }

  async function markAllRead() {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    await markNotificationsRead();
    router.refresh();
  }

  async function openOne(n: NotificationRow) {
    if (n.read_at === null) {
      setItems((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x
        )
      );
      await markNotificationsRead([n.id]);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton aria-label={t("openWithCount", { count: unread })} variant="ghost">
          <span className="relative">
            <Bell aria-hidden className="size-5" />
            {unread > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-accent-fg">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </span>
        </IconButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-medium">{t("title")}</p>
          {unread > 0 ? (
            <Button variant="link" size="sm" onClick={markAllRead} className="h-auto p-0">
              {t("markAllRead")}
            </Button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={<Inbox aria-hidden className="size-5" />}
            title={t("empty")}
            className="border-0 shadow-none"
          />
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {items.map((n) => {
              const body = (
                <>
                  <span className="min-w-0 text-sm text-text">{labelFor(n)}</span>
                  {n.read_at === null ? (
                    <span
                      aria-hidden
                      className="mt-1 size-2 shrink-0 rounded-full bg-accent"
                    />
                  ) : null}
                </>
              );
              const cls =
                "flex items-start justify-between gap-2 px-4 py-3 text-left transition-colors duration-fast hover:bg-accent-muted";
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link href={n.href} className={cls} onClick={() => openOne(n)}>
                      {body}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={`w-full ${cls}`}
                      onClick={() => openOne(n)}
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
