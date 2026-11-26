import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ["", "/login"].map((p) => ({
    url: `${SITE_URL}${p}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: p === "" ? 1 : 0.5,
  }));
}

