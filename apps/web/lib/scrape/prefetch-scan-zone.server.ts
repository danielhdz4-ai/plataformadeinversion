import { importScraperModule, scraperRepoRoot } from "@/lib/scrape/load-scraper-module";
import type { ScanPolygon } from "@/lib/scan/types";
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";

export type ScanZoneIngestResult = {
  ok?: boolean;
  skipped?: boolean;
  reason?: string;
  mode?: string;
  city?: string;
  zones?: string[];
  inPolygonAfter?: number;
  target?: number;
  meetsTarget?: boolean;
  upserted?: number;
  error?: string;
};

export async function prefetchScanZoneInventory(
  polygon: ScanPolygon,
  options?: { scanId?: string; portals?: string[]; postalCode?: string }
): Promise<ScanZoneIngestResult> {
  if (process.env.SCAN_PREFETCH_ENABLED === "0") {
    return { skipped: true, reason: "disabled" };
  }

  if (process.env.VERCEL === "1") {
    process.env.SCAN_CP_SKIP_PLAYWRIGHT = "1";
    process.env.SCAN_ZONE_BOOST_ROUNDS ??= "1";
    process.env.SCAN_FOTOCASA_MAX_PAGES ??= "8";
    process.env.SCAN_FOTOCASA_PER_ZONE ??= "80";
    process.env.SCAN_PISOS_MAX_PAGES ??= "6";
    process.env.SCAN_PISOS_PER_DISTRICT ??= "80";
    process.env.SCAN_CITY_PISOS_MAX ??= "400";
    process.env.SCAN_CITY_PISOS_PAGES ??= "18";
    globalThis.__PI_CREATE_SUPABASE__ = (url: string, key: string) => createClient(url, key);
  }

  const mod = await importScraperModule<{
    ingestZoneForPolygon: (
      p: ScanPolygon,
      o: { scanId?: string; portals?: string[]; postalCode?: string }
    ) => Promise<ScanZoneIngestResult>;
  }>("scripts/scrapers/lib/zone-ingest.mjs");

  return mod.ingestZoneForPolygon(polygon, {
    scanId: options?.scanId,
    portals: options?.portals,
    postalCode: options?.postalCode,
  });
}

export function precomputeRoiForPolygon(polygon: ScanPolygon): void {
  if (process.env.VERCEL === "1") return;
  const root = scraperRepoRoot();
  process.env.POLYGON_GEOJSON = JSON.stringify(polygon);
  spawnSync(process.execPath, ["scripts/jobs/precompute-roi-polygon.mjs"], {
    cwd: root,
    env: { ...process.env },
    stdio: "pipe",
  });
}
