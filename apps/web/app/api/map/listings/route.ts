import { decodeListingTitle } from "@/lib/decode-html";
import { isResidentialPropertyKind } from "@/lib/listing/residential-kind";
import { getDbClient, requireAppUser } from "@/lib/supabase/request-client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = await requireAppUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, code: "AUTH" }, { status: auth.status });
  }

  const supabase = await getDbClient();

  const p = req.nextUrl.searchParams;
  const minLng = Number(p.get("minLng"));
  const minLat = Number(p.get("minLat"));
  const maxLng = Number(p.get("maxLng"));
  const maxLat = Number(p.get("maxLat"));
  const zoom = p.get("zoom") != null ? Number(p.get("zoom")) : null;
  if ([minLng, minLat, maxLng, maxLat].some((n) => Number.isNaN(n))) {
    return NextResponse.json({ error: "Invalid bbox", code: "VALIDATION" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("map_listings_in_bbox", {
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
    max_rows: 500,
  });

  if (error) {
    return NextResponse.json({ error: error.message, code: "DB" }, { status: 500 });
  }

  type BboxRow = {
    id: string;
    lng: number;
    lat: number;
    roi_gross: number | null;
    price: number;
    geocode_quality?: number;
    rent_confidence?: string | null;
  };

  let rows = (data ?? []) as BboxRow[];
  if (zoom != null && zoom >= 14) {
    rows = rows.filter((r) => (r.geocode_quality ?? 1) < 5);
  }

  const ids = rows.map((row) => row.id);
  const { data: meta } =
    ids.length > 0
      ? await supabase
          .from("listings")
          .select(
            "id, source_portal, title, source_url, city, thumbnail_url, bedrooms, bathrooms, sqm, property_kind, scraped_at, listing_investment(rent_est, rent_confidence)"
          )
          .in("id", ids)
      : { data: [] };
  const metaMap = new Map((meta ?? []).map((m) => [m.id, m]));

  const features = rows
    .filter((row) => {
      const m = metaMap.get(row.id) as { property_kind?: string | null } | undefined;
      return isResidentialPropertyKind(m?.property_kind);
    })
    .map(
    (row: BboxRow) => {
      const m = metaMap.get(row.id) as Record<string, unknown> | undefined;
      const inv = m?.listing_investment as
        | { rent_est?: number; rent_confidence?: string | null }
        | { rent_est?: number; rent_confidence?: string | null }[]
        | null;
      const invRow = Array.isArray(inv) ? inv[0] : inv;
      const rent = invRow?.rent_est;
      const rentConfidence =
        row.rent_confidence ?? invRow?.rent_confidence ?? null;
      return {
        id: row.id,
        lng: row.lng,
        lat: row.lat,
        roi: row.roi_gross,
        price: row.price,
        geocodeQuality: row.geocode_quality ?? null,
        rentConfidence,
        source: (m?.source_portal as string) ?? null,
        title: decodeListingTitle(m?.title as string),
        sourceUrl: (m?.source_url as string) ?? null,
        city: (m?.city as string) ?? null,
        thumbnailUrl: (m?.thumbnail_url as string) ?? null,
        bedrooms: (m?.bedrooms as number) ?? null,
        bathrooms: (m?.bathrooms as number) ?? null,
        sqm: (m?.sqm as number) ?? null,
        rentEst: rent ?? null,
        scrapedAt: (m?.scraped_at as string) ?? null,
      };
    }
  );

  return NextResponse.json({ features });
}
