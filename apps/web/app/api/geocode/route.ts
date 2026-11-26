import {
  extractPostalFromQuery,
  geocodeSpainQuery,
  normalizeSpanishPostalCode,
} from "@/lib/map/geocode-spain";
import { getCachedPostalHit, setCachedPostalHit } from "@/lib/map/geocode-cache";
import { NextRequest, NextResponse } from "next/server";

async function zippopotamFallback(postal: string) {
  const cached = getCachedPostalHit(postal);
  if (cached) return [cached];
  try {
    const res = await fetch(`https://api.zippopotam.us/ES/${postal}`, {
      next: { revalidate: 604800 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      places?: { "place name"?: string; latitude?: string; longitude?: string; state?: string }[];
    };
    const place = data.places?.[0];
    if (!place?.latitude || !place.longitude) return [];
    const hit = {
      label: [`CP ${postal}`, place["place name"], place.state, "España"].filter(Boolean).join(", "),
      lat: Number(place.latitude),
      lng: Number(place.longitude),
      bbox: null as [number, number, number, number] | null,
    };
    setCachedPostalHit(postal, hit);
    return [hit];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Escribe al menos 2 caracteres para buscar." }, { status: 400 });
  }

  try {
    const results = await geocodeSpainQuery(q);
    if (results.length) return NextResponse.json({ results });
    const pc =
      extractPostalFromQuery(q)?.postal ??
      normalizeSpanishPostalCode(q) ??
      null;
    if (pc) {
      const fallback = await zippopotamFallback(pc);
      if (fallback.length) return NextResponse.json({ results: fallback });
    }
    return NextResponse.json({ results: [] });
  } catch {
    const pc = normalizeSpanishPostalCode(q ?? "");
    if (pc) {
      const fallback = await zippopotamFallback(pc);
      if (fallback.length) return NextResponse.json({ results: fallback });
    }
    return NextResponse.json({ error: "La búsqueda no está disponible ahora mismo." }, { status: 502 });
  }
}
