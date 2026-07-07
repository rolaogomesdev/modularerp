// Locale packs (docs/architecture/01-tech-stack.md).
// Locale is a per-user setting (personal profile), not a URL segment —
// the app resolves it per request: cookie override → device language → default.

export const locales = ["pt-PT", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pt-PT";

/** Cookie carrying the per-user locale override (set by the profile UI, Phase 2). */
export const LOCALE_COOKIE = "locale";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Minimal Accept-Language negotiation until profiles exist: any pt-* → pt-PT. */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;
  return acceptLanguage.toLowerCase().includes("pt") ? "pt-PT" : "en";
}
