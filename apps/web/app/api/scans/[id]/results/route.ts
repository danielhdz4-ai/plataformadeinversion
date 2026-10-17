import { isOpenAccess } from "@/lib/open-access";
import { parseScanPolygon } from "@/lib/map/parse-scan-polygon";
import { applyBedroomFilter, type ScanRunFilters } from "@/lib/scan/bedroom-filter";
import {
  listingMatchesScanFilters,
  normalizeScanFilters,
} from "@/lib/scan/apply-scan-filters";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDbClient, requireAppUser } from "@/lib/supabase/request-client";
import { NextResponse } from "next/server";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await getDbClient();
  if (!isOpenAccess()) {
    const auth = await requireAppUser();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { data: scan } = await supabase.from("scans").select("user_id").eq("id", id).single();
    if (!scan || scan.user_id !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: scanRow } = await supabase.from("scans").select("polygon, filters").eq("id", id).single();
  const polygon = parseScanPolygon(scanRow?.polygon);
  const scanFilters = normalizeScanFilters(
    (scanRow?.filters ?? {}) as Record<string, unknown>
  );
  const priceMin = scanFilters.priceMin ?? 0;
  const priceMax = scanFilters.priceMax ?? 999_999_999;

  const { data, error } = await supabase
    .from("scan_results")
    .select(
      `
      rank,
      roi_gross,
      listing:listings (
        id, title, price, source_url, city, source_portal, thumbnail_url,
        bedrooms, bathrooms, sqm,
        listing_investment ( rent_est, rent_confidence )
      )
    `
    )
    .eq("scan_id", id)
    .order("rank");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rawResults = (data ?? []).map((row) => ({
    rank: row.rank,
    roi_gross: row.roi_gross,
    listing: Array.isArray(row.listing) ? row.listing[0] : row.listing,
  }));

  type ScanResultPayload = {
    rank: number;
    roi_gross: number;
    listing: Record<string, unknown> | null;
  };

  const rankedResults: ScanResultPayload[] = rawResults
    .filter((r) => {
      const l = r.listing as { price?: number; bedrooms?: number | null } | null;
      if (!l) return false;
      return listingMatchesScanFilters(l, scanFilters);
    })
    .map((r, i) => ({
      rank: i + 1,
      roi_gross: r.roi_gross,
      listing: (r.listing ?? null) as Record<string, unknown> | null,
    }));

  const usedRankFilter = rawResults.length > 0 && rankedResults.length < rawResults.length;

  const mapPinsFromIds = async (pinIds: string[]) => {
    if (pinIds.length === 0) return [];
    const { data: pinRows } = await supabase.rpc("listings_pins_by_ids", { ids: pinIds });
    return (pinRows ?? []).map(
      (p: { id: string; lng: number; lat: number; price: number; roi_gross: number | null }) => ({
        id: p.id,
        lng: p.lng,
        lat: p.lat,
        price: Number(p.price),
        roi: p.roi_gross != null ? Number(p.roi_gross) : null,
      })
    );
  };

  async function listingsInZoneFiltered() {
    if (!polygon) return [];
    const geojson = JSON.stringify(polygon);
    const admin = createAdminClient();
    const { data: inPoly } = await admin.rpc("listings_in_polygon", { geojson });
    const ids = ((inPoly ?? []) as { id: string }[]).map((r) => r.id);
    if (ids.length === 0) return [];

    let q = supabase
      .from("listings")
      .select(
        `
        id, title, price, source_url, city, source_portal, thumbnail_url,
        bedrooms, bathrooms, sqm,
        listing_investment ( rent_est, rent_confidence, roi_gross )
      `
      )
      .in("id", ids)
      .eq("status", "active")
      .eq("operation", "sale")
      .gte("price", priceMin)
      .lte("price", priceMax);
    q = applyBedroomFilter(q, scanFilters as ScanRunFilters);
    const { data: rows } = await q;
    return rows ?? [];
  }

  let displayResults = rankedResults;
  let usedMapFallback = false;

  if (displayResults.length === 0) {
    const zoneRows = await listingsInZoneFiltered();
    if (zoneRows.length > 0) {
      usedMapFallback = rawResults.length === 0;
      const mapped = zoneRows
        .map((l) => {
          const inv = Array.isArray(l.listing_investment)
            ? l.listing_investment[0]
            : l.listing_investment;
          const roi =
            inv?.roi_gross != null
              ? Number(inv.roi_gross)
              : inv?.rent_est && l.price
                ? ((Number(inv.rent_est) * 12) / Number(l.price)) * 100
                : 0;
          return {
            rank: 0,
            roi_gross: Number(roi),
            listing: {
              id: l.id,
              title: l.title,
              price: l.price,
              source_url: l.source_url,
              city: l.city,
              source_portal: l.source_portal,
              thumbnail_url: l.thumbnail_url,
              bedrooms: l.bedrooms,
              bathrooms: l.bathrooms,
              sqm: l.sqm,
              listing_investment: inv
                ? {
                    rent_est: inv.rent_est != null ? Number(inv.rent_est) : null,
                    rent_confidence: inv.rent_confidence as string | null,
                  }
                : undefined,
            },
          };
        })
        .sort((a, b) => b.roi_gross - a.roi_gross);

      displayResults = mapped.map((r, i) => ({
        rank: i + 1,
        roi_gross: r.roi_gross,
        listing: r.listing as Record<string, unknown>,
      }));
    }
  }

  const pinIds = displayResults.map((r) => r.listing?.id).filter(Boolean) as string[];
  let pins = await mapPinsFromIds(pinIds);

  if (pins.length === 0 && polygon?.coordinates?.[0]?.length) {
    const ring = polygon.coordinates[0];
    const lngs = ring.map((c) => c[0]!);
    const lats = ring.map((c) => c[1]!);
    const { data: mapRows } = await supabase.rpc("map_listings_in_bbox", {
      min_lng: Math.min(...lngs),
      min_lat: Math.min(...lats),
      max_lng: Math.max(...lngs),
      max_lat: Math.max(...lats),
      max_rows: 800,
    });
    pins = (mapRows ?? [])
      .map(
        (p: { id: string; lng: number; lat: number; price: number; roi_gross: number | null }) => ({
          id: p.id,
          lng: p.lng,
          lat: p.lat,
          price: Number(p.price),
          roi: p.roi_gross != null ? Number(p.roi_gross) : null,
        })
      )
      .filter((p: { price: number }) => p.price >= priceMin && p.price <= priceMax);
  }

  return NextResponse.json({
    results: displayResults,
    pins,
    mapCount: pins.length,
    polygon,
    filters: scanFilters,
    usedMapFallback,
    usedRankFilter,
  });
}
