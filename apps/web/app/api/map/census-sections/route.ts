import { getDbClient, requireAppUser } from "@/lib/supabase/request-client";
import { USER_DB_ERROR } from "@/lib/ops/db-api-errors";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = await requireAppUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, code: "AUTH" }, { status: auth.status });
  }

  const p = req.nextUrl.searchParams;
  const minLng = Number(p.get("minLng"));
  const minLat = Number(p.get("minLat"));
  const maxLng = Number(p.get("maxLng"));
  const maxLat = Number(p.get("maxLat"));
  if ([minLng, minLat, maxLng, maxLat].some((n) => Number.isNaN(n))) {
    return NextResponse.json({ error: "Invalid bbox", code: "VALIDATION" }, { status: 400 });
  }

  const zoom = p.get("zoom") != null ? Number(p.get("zoom")) : 12;
  if (zoom < 11) {
    return NextResponse.json({ type: "FeatureCollection", features: [] });
  }

  const supabase = await getDbClient();
  const { data, error } = await supabase.rpc("census_sections_in_bbox", {
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
    max_features: zoom >= 14 ? 200 : 80,
  });

  if (error) {
    const missing = /census_sections|function/i.test(error.message);
    if (!missing) console.error("[api/map/census-sections]", error.message);
    return NextResponse.json(
      {
        error: missing
          ? "La capa de datos del INE todavía no está disponible en esta zona."
          : USER_DB_ERROR,
      },
      { status: missing ? 503 : 500 }
    );
  }

  const features = (data ?? []).map(
    (row: { cusec: string; section_name: string | null; metrics_year: number | null; geojson: unknown }) => ({
      type: "Feature" as const,
      properties: {
        cusec: row.cusec,
        sectionName: row.section_name,
        metricsYear: row.metrics_year,
      },
      geometry: row.geojson,
    })
  );

  return NextResponse.json({ type: "FeatureCollection", features });
}
