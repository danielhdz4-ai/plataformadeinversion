import { decodeListingTitle } from "@/lib/decode-html";
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

  const ids = (data ?? []).map((row: { id: string }) => row.id);
  const { data: meta } =
    ids.length > 0
      ? await supabase
          .from("listings")
          .select(
            "id, source_portal, title, source_url, city, thumbnail_url, bedrooms, bathrooms, sqm, listing_investment(rent_est)"
          )
          .in("id", ids)
      : { data: [] };
  const metaMap = new Map((meta ?? []).map((m) => [m.id, m]));

  const features = (data ?? []).map(
    (row: { id: string; lng: number; lat: number; roi_gross: number | null; price: number }) => {
      const m = metaMap.get(row.id) as Record<string, unknown> | undefined;
      const inv = m?.listing_investment as { rent_est?: number } | { rent_est?: number }[] | null;
      const rent = Array.isArray(inv) ? inv[0]?.rent_est : inv?.rent_est;
      return {
        id: row.id,
        lng: row.lng,
        lat: row.lat,
        roi: row.roi_gross,
        price: row.price,
        source: (m?.source_portal as string) ?? null,
        title: decodeListingTitle(m?.title as string),
        sourceUrl: (m?.source_url as string) ?? null,
        city: (m?.city as string) ?? null,
        thumbnailUrl: (m?.thumbnail_url as string) ?? null,
        bedrooms: (m?.bedrooms as number) ?? null,
        bathrooms: (m?.bathrooms as number) ?? null,
        sqm: (m?.sqm as number) ?? null,
        rentEst: rent ?? null,
      };
    }
  );

  return NextResponse.json({ features });
}
