import { SPAIN_BBOX } from "@/lib/map/spain-bounds";
import { NextRequest, NextResponse } from "next/server";

type NominatimItem = {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: [string, string, string, string];
};

function inSpain(lng: number, lat: number) {
  return (
    lng >= SPAIN_BBOX.minLng &&
    lng <= SPAIN_BBOX.maxLng &&
    lat >= SPAIN_BBOX.minLat &&
    lat <= SPAIN_BBOX.maxLat
  );
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("limit", "8");
  url.searchParams.set("countrycodes", "es");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "plataformadeinversion/1.0 (investment scan; contact: danielhdz4-ai)" },
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Geocoder unavailable" }, { status: 502 });
  }

  const raw = (await res.json()) as NominatimItem[];
  const results = raw
    .map((item) => ({
      label: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
      bbox: item.boundingbox
        ? ([
            Number(item.boundingbox[2]),
            Number(item.boundingbox[0]),
            Number(item.boundingbox[3]),
            Number(item.boundingbox[1]),
          ] as [number, number, number, number])
        : null,
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && inSpain(r.lng, r.lat));

  return NextResponse.json({ results });
}
