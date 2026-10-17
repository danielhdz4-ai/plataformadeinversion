import { isResidentialPropertyKind } from "@/lib/listing/residential-kind";
import { applyBedroomFilter, type ScanRunFilters } from "@/lib/scan/bedroom-filter";
import { listingMatchesScanFilters, normalizeScanFilters } from "@/lib/scan/apply-scan-filters";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ScanPolygon } from "@/lib/scan/types";
import { grossRoiPct } from "@pi/roi-engine";

export async function runScanForPolygon(
  scanId: string,
  polygon: ScanPolygon,
  filters: ScanRunFilters
) {
  const admin = createAdminClient();
  await admin.from("scans").update({ status: "running", progress_pct: 10 }).eq("id", scanId);

  const norm = normalizeScanFilters(filters as Record<string, unknown>);
  const priceMin = norm.priceMin ?? 0;
  const priceMax = norm.priceMax ?? 999_999_999;
  if (!Number.isFinite(priceMin) || !Number.isFinite(priceMax)) {
    throw new Error("Filtros de precio inválidos");
  }

  const geojson = JSON.stringify(polygon);
  const { data: inPoly, error: polyErr } = await admin.rpc("listings_in_polygon", {
    geojson,
  });

  if (polyErr) {
    throw new Error(`Consulta de polígono fallida: ${polyErr.message}`);
  }
  const inPolyRows = (inPoly ?? []) as { id: string }[];
  const ids = inPolyRows.map((r) => r.id);
  if (ids.length === 0) {
    await admin.from("scans").update({ status: "completed", progress_pct: 100 }).eq("id", scanId);
    return 0;
  }

  let q = admin
    .from("listings")
    .select("id, price, bedrooms, property_kind")
    .in("id", ids)
    .eq("status", "active")
    .eq("operation", "sale")
    .gte("price", priceMin)
    .lte("price", priceMax);

  q = applyBedroomFilter(q, norm);

  const { data: listings, error } = await q;
  if (error) throw error;

  const listingIds = (listings ?? []).map((l) => l.id as string);
  const { data: investments } = await admin
    .from("listing_investment")
    .select("listing_id, rent_est, roi_gross")
    .in("listing_id", listingIds);

  const invMap = new Map(
    (investments ?? []).map((i) => [i.listing_id as string, i as { rent_est: number | null; roi_gross: number | null }])
  );

  const filteredListings = (listings ?? []).filter((l) =>
    isResidentialPropertyKind(l.property_kind as string | null) &&
    listingMatchesScanFilters(
      { price: Number(l.price), bedrooms: l.bedrooms as number | null },
      norm
    )
  );

  const ranked = filteredListings
    .map((l) => {
      const inv = invMap.get(l.id as string);
      const roi =
        inv?.roi_gross ??
        (inv?.rent_est ? grossRoiPct(Number(l.price), Number(inv.rent_est)) : 0);
      return { listing_id: l.id as string, roi_gross: Number(roi) };
    })
    .sort((a, b) => b.roi_gross - a.roi_gross);

  await admin.from("scan_results").delete().eq("scan_id", scanId);
  if (ranked.length > 0) {
    await admin.from("scan_results").insert(
      ranked.map((r, i) => ({
        scan_id: scanId,
        listing_id: r.listing_id,
        rank: i + 1,
        roi_gross: r.roi_gross,
      }))
    );
  }

  await admin.from("scans").update({ status: "completed", progress_pct: 100 }).eq("id", scanId);
  return ranked.length;
}
