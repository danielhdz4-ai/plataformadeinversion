import { geocodeSpainQuery } from "@/lib/map/geocode-spain";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  try {
    const results = await geocodeSpainQuery(q);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Geocoder unavailable" }, { status: 502 });
  }
}
