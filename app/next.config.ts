import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/ui", "@repo/i18n", "@repo/permissions", "@repo/ai"],
};

export default nextConfig;
