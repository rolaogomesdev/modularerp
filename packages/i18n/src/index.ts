// Locale packs (docs/architecture/01-tech-stack.md). next-intl wiring is a later Phase 0 item.
export const locales = ["pt-PT", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pt-PT";
