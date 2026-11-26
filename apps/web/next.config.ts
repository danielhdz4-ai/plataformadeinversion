import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  transpilePackages: ["@pi/roi-engine", "@pi/db-types"],
  outputFileTracingRoot: root,
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./scripts/**/*",
      "./apps/web/scripts/**/*",
      "./apps/web/lib/scraper-runtime/**/*",
      "./package.json",
      "./apps/web/package.json",
    ],
  },
};

export default nextConfig;
