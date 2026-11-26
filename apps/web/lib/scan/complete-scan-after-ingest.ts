import { geocodeSpainQuery, reverseGeocodeSpain } from "@/lib/map/geocode-spain";
import { promiseWithTimeout } from "@/lib/ops/promise-timeout";
import { normalizeScanFilters } from "@/lib/scan/apply-scan-filters";
import { runScanForPolygon } from "@/lib/scan/runScan";
import { defaultPortalToggles, selectedPortals } from "@/lib/scan/portal-options";
import { SCAN_ZONE_SOFT_WARN_BELOW } from "@/lib/scan/zone-target";
import { lowStockNotice } from "@/lib/scan/user-facing-messages";
import type { ScanZoneIngestResult } from "@/lib/scrape/prefetch-scan-zone.server";
import type { ScanPolygon } from "@/lib/scan/types";
import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";
import { createAdminClient } from "@/lib/supabase/admin";

/** ROI + ranking tras importar inventario (Vercel o Actions). */
export async function completeScanAfterIngest(
  scanId: string,
  polygon: ScanPolygon,
  filters: ScanRunFilters,
  operation: string,
  ingest: Pick<
    ScanZoneIngestResult,
    "ok" | "error" | "inPolygonAfter" | "target" | "meetsTarget"
  > = {}
) {
  const admin = createAdminClient();
  await admin.from("scans").update({ progress_pct: 75 }).eq("id", scanId);

  /** Sin ROI, el ranking sale vacío aunque el inventario sea nuevo. */
  if (process.env.SCAN_ROI_ENSURE_ENABLED !== "0") {
    try {
      const ring = polygon?.coordinates?.[0];
      if (ring?.length) {
        const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
        const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
        const rev = await reverseGeocodeSpain(lat, lng);
        let cp = rev?.label.match(/\b(\d{5})\b/)?.[1];
        if (!cp) {
          const hits = await geocodeSpainQuery(`${lat.toFixed(5)},${lng.toFixed(5)}`);
          cp = hits[0]?.label.match(/\b(\d{5})\b/)?.[1];
        }
        if (cp) {
          const { ensureFreshRoi } = await import("@/lib/scrape/ensure-fresh-roi.server");
          const r = await promiseWithTimeout(ensureFreshRoi(cp), 60_000, "roi_timeout");
          console.info("scan roi ensure", scanId, cp, r);
        }
      }
    } catch (e) {
      console.warn("scan roi ensure skipped", scanId, e);
    }
  }

  await runScanForPolygon(scanId, polygon, filters, operation);

  if (
    ingest.inPolygonAfter != null &&
    ingest.target != null &&
    !ingest.meetsTarget &&
    ingest.inPolygonAfter < SCAN_ZONE_SOFT_WARN_BELOW
  ) {
    await admin
      .from("scans")
      .update({ error_message: lowStockNotice(ingest.inPolygonAfter) })
      .eq("id", scanId);
  } else {
    await admin.from("scans").update({ error_message: null }).eq("id", scanId);
  }
}

export function resolveScanPortals(filters: ScanRunFilters): string[] {
  const norm = normalizeScanFilters(filters as Record<string, unknown>);
  let portals = norm.sourcePortals;
  if (!portals?.length) portals = selectedPortals(defaultPortalToggles());
  if (!portals.includes("pisos_com")) portals = [...portals, "pisos_com"];
  return portals;
}
