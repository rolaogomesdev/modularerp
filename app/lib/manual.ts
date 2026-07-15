// Manual (in-app /help) types + audience filtering. Content is generated into
// manual.generated.ts by scripts/build-manual.mjs; this file is the stable API.
import { MANUAL } from "./manual.generated";

export const MANUAL_AUDIENCES = [
  "platform-admin",
  "company-admin",
  "team-manager",
  "member",
] as const;
export type ManualAudience = (typeof MANUAL_AUDIENCES)[number];

export type ManualEntry = {
  slug: string; // e.g. "company-admin/teams-roles-and-members"
  title: string;
  section: string; // top-level folder, e.g. "company-admin"
  audience: string[];
  module: string | null;
  feature: string | null;
  path: string | null; // in-app navigation path from front-matter
  status: string; // "live" | "planned" | …
  updated: string | null;
  html: string;
};

/**
 * Pages visible to a user with the given audiences: live pages whose audience
 * front-matter intersects theirs. Platform admins see everything (they support
 * every tenant). Draft/planned pages are hidden from everyone.
 */
export function visibleManual(audiences: string[]): ManualEntry[] {
  const isPlatformAdmin = audiences.includes("platform-admin");
  return MANUAL.filter(
    (e) =>
      e.status === "live" &&
      (isPlatformAdmin || e.audience.some((a) => audiences.includes(a)))
  );
}

export function findManualEntry(
  slug: string,
  audiences: string[]
): ManualEntry | undefined {
  return visibleManual(audiences).find((e) => e.slug === slug);
}

/** Group entries by section, preserving each section's first-seen order. */
export function groupBySection(
  entries: ManualEntry[]
): Array<{ section: string; entries: ManualEntry[] }> {
  const order: string[] = [];
  const map = new Map<string, ManualEntry[]>();
  for (const e of entries) {
    if (!map.has(e.section)) {
      map.set(e.section, []);
      order.push(e.section);
    }
    map.get(e.section)!.push(e);
  }
  return order.map((section) => ({ section, entries: map.get(section)! }));
}
