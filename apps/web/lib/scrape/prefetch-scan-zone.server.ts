import type { ScanPolygon } from "@/lib/scan/types";
import { join } from "path";

function repoRoot() {
  const cwd = process.cwd();
  if (cwd.replace(/\\/g, "/").endsWith("/apps/web")) {
    return join(cwd, "../..");
  }
  return cwd;
}

export type ScanPrefetchResult = {
  skipped?: boolean;
  reason?: string;
  mode?: string;
  zones?: string[];
  center?: { lat: number; lng: number; radiusKm: number };
};

/** Importa el job Node de scrapers (solo servidor). */
export async function prefetchScanZoneInventory(
  polygon: ScanPolygon
): Promise<ScanPrefetchResult> {
  if (process.env.SCAN_PREFETCH_ENABLED === "0") {
    return { skipped: true, reason: "disabled" };
  }
  const modPath = join(repoRoot(), "scripts/scrapers/lib/prefetch-scan-zone.mjs");
  const mod = (await import(/* webpackIgnore: true */ modPath)) as {
    prefetchForScanPolygon: (p: ScanPolygon) => Promise<ScanPrefetchResult>;
  };
  return mod.prefetchForScanPolygon(polygon);
}
