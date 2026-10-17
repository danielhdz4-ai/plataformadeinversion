import { isOpenAccess } from "@/lib/open-access";
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
  const polygon = scanRow?.polygon as {
    coordinates?: number[][][];
  } | null;
  const scanFilters = (scanRow?.filters ?? {}) as {
    priceMin?: number;
    priceMax?: number;
    bedroomsMin?: number;
  };

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

  const results = (data ?? []).map((row) => ({
    rank: row.rank,
    roi_gross: row.roi_gross,
    listing: Array.isArray(row.listing) ? row.listing[0] : row.listing,
  }));

  const ids = results.map((r) => r.listing?.id).filter(Boolean) as string[];
  let pins: { id: string; lng: number; lat: number; price: number; roi: number | null }[] = [];

  const mapPinsFromIds = async (pinIds: string[]) => {
    if (pinIds.length === 0) return [];
    const { data: pinRows } = await supabase.rpc("listings_pins_by_ids", { ids: pinIds });
    const roiByListing = new Map(
      results.map((r) => [r.listing?.id, r.roi_gross != null ? Number(r.roi_gross) : null])
    );
    return (pinRows ?? []).map(
      (p: { id: string; lng: number; lat: number; price: number; roi_gross: number | null }) => ({
        id: p.id,
        lng: p.lng,
        lat: p.lat,
        price: Number(p.price),
        roi:
          roiByListing.get(p.id) ??
          (p.roi_gross != null ? Number(p.roi_gross) : null),
      })
    );
  };

  if (ids.length > 0) {
    pins = await mapPinsFromIds(ids);
  } else if (polygon?.coordinates?.[0]?.length) {
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
    pins = (mapRows ?? []).map(
      (p: { id: string; lng: number; lat: number; price: number; roi_gross: number | null }) => ({
        id: p.id,
        lng: p.lng,
        lat: p.lat,
        price: Number(p.price),
        roi: p.roi_gross != null ? Number(p.roi_gross) : null,
      })
    );
  }

  type ScanResultPayload = {
    rank: number;
    roi_gross: number;
    listing: Record<string, unknown> | null;
  };

  let displayResults: ScanResultPayload[] = results.map((r) => ({
    rank: r.rank,
    roi_gross: r.roi_gross,
    listing: (r.listing ?? null) as Record<string, unknown> | null,
  }));

  if (displayResults.length === 0 && pins.length > 0) {
    const pinIds = pins.slice(0, 60).map((p) => p.id);
    const { data: fallbackRows } = await supabase
      .from("listings")
      .select(
        `
        id, title, price, source_url, city, source_portal, thumbnail_url,
        bedrooms, bathrooms, sqm,
        listing_investment ( rent_est, rent_confidence, roi_gross )
      `
      )
      .in("id", pinIds)
      .eq("status", "active")
      .eq("operation", "sale");

    const pinById = new Map(pins.map((p) => [p.id, p]));
    const mapped = (fallbackRows ?? [])
      .map((l) => {
        const inv = Array.isArray(l.listing_investment)
          ? l.listing_investment[0]
          : l.listing_investment;
        const pin = pinById.get(l.id as string);
        const roi =
          inv?.roi_gross != null
            ? Number(inv.roi_gross)
            : pin?.roi != null
              ? pin.roi
              : 0;
        return {
          rank: 0,
          roi_gross: roi,
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

  return NextResponse.json({
    results: displayResults,
    pins,
    mapCount: pins.length,
    filters: scanFilters,
    usedMapFallback: results.length === 0 && displayResults.length > 0,
  });
}
