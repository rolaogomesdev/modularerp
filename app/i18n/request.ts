import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import {
  isLocale,
  LOCALE_COOKIE,
  negotiateLocale,
  type Locale,
} from "@repo/i18n";

// Static import map so the bundler can trace the catalogs.
const catalogs: Record<Locale, () => Promise<{ default: Record<string, unknown> }>> = {
  "pt-PT": () => import("@repo/i18n/messages/pt-PT.json"),
  en: () => import("@repo/i18n/messages/en.json"),
};

export default getRequestConfig(async () => {
  const cookieValue = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale =
    cookieValue !== undefined && isLocale(cookieValue)
      ? cookieValue
      : negotiateLocale((await headers()).get("accept-language"));

  return {
    locale,
    messages: (await catalogs[locale]()).default,
  };
});
