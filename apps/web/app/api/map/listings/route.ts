import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized", code: "AUTH" }, { status: 401 });

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

  const features = (data ?? []).map(
    (row: { id: string; lng: number; lat: number; roi_gross: number | null; price: number }) => ({
      id: row.id,
      lng: row.lng,
      lat: row.lat,
      roi: row.roi_gross,
      price: row.price,
    })
  );

  return NextResponse.json({ features });
}
