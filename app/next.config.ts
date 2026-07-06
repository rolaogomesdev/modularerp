import type { NextConfig } from "next";

// NOTE: we intentionally do NOT use createNextIntlPlugin() — it hard-requires
// @swc/core's native binary, which Windows Smart App Control blocks (unsigned).
// The alias below is the only part of the plugin we need: it points next-intl's
// internal `next-intl/config` import at our request config.
const nextConfig: NextConfig = {
  transpilePackages: ["@repo/ui", "@repo/i18n", "@repo/permissions", "@repo/ai"],
  turbopack: {
    resolveAlias: {
      "next-intl/config": "./i18n/request.ts",
    },
  },
};

export default nextConfig;
