"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type NotificationRow = {
  id: string;
  kind: string;
  params: Record<string, unknown>;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

/** Mark specific notifications read, or all of the caller's unread when omitted. */
export async function markNotificationsRead(ids?: string[]): Promise<number> {
  const parsed = z.array(z.string().uuid()).max(200).optional().safeParse(ids);
  if (!parsed.success) return 0;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_notifications_read", {
    notification_ids: parsed.data ?? null,
  });
  return error ? 0 : (data as number);
}
