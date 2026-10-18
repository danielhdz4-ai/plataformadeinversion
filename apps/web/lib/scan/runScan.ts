import { resolveListingGrossRoiPct } from "@/lib/listing/gross-roi";
import { resolveRentEstMonthly } from "@/lib/listing/rent-est";
import { isResidentialPropertyKind } from "@/lib/listing/residential-kind";
import { scanOperationUsesRoi } from "@/lib/investment/operations";
import { applyBathroomFilter, applyBedroomFilter, type ScanRunFilters } from "@/lib/scan/bedroom-filter";
import { listingMatchesScanFilters, normalizeScanFilters } from "@/lib/scan/apply-scan-filters";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ScanPolygon } from "@/lib/scan/types";

export async function runScanForPolygon(
  scanId: string,
  polygon: ScanPolygon,
  filters: ScanRunFilters,
  operation: string = "buy_to_rent"
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
    .select("id, price, bedrooms, bathrooms, sqm, property_kind, source_portal")
    .in("id", ids)
    .eq("status", "active")
    .eq("operation", "sale")
    .gte("price", priceMin)
    .lte("price", priceMax);

  if (norm.sourcePortals?.length) {
    q = q.in("source_portal", norm.sourcePortals);
  }

  q = applyBedroomFilter(q, norm);
  q = applyBathroomFilter(q, norm);

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

  const useRoi = scanOperationUsesRoi(operation);
  const minRoi = norm.minRoiGross ?? 0;

  const filteredListings = (listings ?? []).filter((l) => {
    if (!isResidentialPropertyKind(l.property_kind as string | null)) return false;
    if (
      !listingMatchesScanFilters(
        {
          price: Number(l.price),
          bedrooms: l.bedrooms as number | null,
          bathrooms: l.bathrooms as number | null,
          sqm: l.sqm as number | null,
          source_portal: l.source_portal as string | null,
        },
        norm
      )
    ) {
      return false;
    }
    if (!useRoi) return true;
    const inv = invMap.get(l.id as string);
    const price = Number(l.price);
    const rent = resolveRentEstMonthly(price, inv?.rent_est ?? null);
    const roi = resolveListingGrossRoiPct(price, rent, inv?.roi_gross ?? null);
    if (norm.onlyWithRoi && (roi == null || roi <= 0)) return false;
    if (minRoi > 0 && (roi == null || roi < minRoi)) return false;
    return true;
  });

  const ranked = filteredListings
    .map((l) => {
      const price = Number(l.price);
      const inv = invMap.get(l.id as string);
      if (!useRoi) {
        return { listing_id: l.id as string, roi_gross: 0, price };
      }
      const rent = resolveRentEstMonthly(price, inv?.rent_est ?? null);
      const roi = resolveListingGrossRoiPct(price, rent, inv?.roi_gross ?? null) ?? 0;
      return { listing_id: l.id as string, roi_gross: roi, price };
    })
    .sort((a, b) =>
      useRoi ? b.roi_gross - a.roi_gross : a.price - b.price
    );

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
