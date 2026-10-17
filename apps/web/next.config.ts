import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pi/roi-engine", "@pi/db-types"],
};

export default nextConfig;
