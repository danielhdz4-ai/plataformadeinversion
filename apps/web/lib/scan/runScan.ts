import { createAdminClient } from "@/lib/supabase/admin";
import type { ScanPolygon } from "@/lib/scan/types";
import { grossRoiPct } from "@pi/roi-engine";

type Filters = {
  priceMin?: number;
  priceMax?: number;
  bedroomsMin?: number;
};

export async function runScanForPolygon(
  scanId: string,
  polygon: ScanPolygon,
  filters: Filters
) {
  const admin = createAdminClient();
  await admin.from("scans").update({ status: "running", progress_pct: 10 }).eq("id", scanId);

  const ring = polygon.coordinates[0]!;
  const lngs = ring.map((c) => c[0]!);
  const lats = ring.map((c) => c[1]!);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const geojson = JSON.stringify(polygon);
  const { data: inPoly, error: polyErr } = await admin.rpc("listings_in_polygon", {
    geojson,
  });

  let ids: string[];
  if (!polyErr && inPoly && (inPoly as { id: string }[]).length > 0) {
    ids = (inPoly as { id: string }[]).map((r) => r.id);
  } else {
    const { data: inBbox, error: bboxErr } = await admin.rpc("listings_in_bbox", {
      min_lng: minLng,
      min_lat: minLat,
      max_lng: maxLng,
      max_lat: maxLat,
    });
    if (bboxErr) throw bboxErr;
    ids = (inBbox as { id: string }[]).map((r) => r.id);
  }
  if (ids.length === 0) {
    await admin.from("scans").update({ status: "completed", progress_pct: 100 }).eq("id", scanId);
    return 0;
  }

  let q = admin
    .from("listings")
    .select("id, price, bedrooms")
    .in("id", ids)
    .eq("status", "active")
    .eq("operation", "sale")
    .gte("price", filters.priceMin ?? 0)
    .lte("price", filters.priceMax ?? 999_999_999);

  if (filters.bedroomsMin) q = q.gte("bedrooms", filters.bedroomsMin);

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

  const ranked = (listings ?? [])
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
