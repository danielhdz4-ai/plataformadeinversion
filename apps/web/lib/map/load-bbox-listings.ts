import type { SupabaseClient } from "@supabase/supabase-js";

export type MapBboxRow = {
  id: string;
  lng: number;
  lat: number;
  roi_gross: number | null;
  price: number;
  geocode_quality?: number;
  rent_confidence?: string | null;
};

export const MAP_LISTINGS_LIMIT = 500;
export const MAP_LISTINGS_FETCH = 1000;

export const MAP_PORTALS = [
  "kelify",
  "pisos_com",
  "hipoges",
  "solvia",
  "fotocasa",
  "habitaclia",
] as const;

/** Bbox mayor que ~una comunidad autónoma → mezclar fuentes por portal. */
export function isLargeMapBbox(
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number
): boolean {
  const spanLng = Math.abs(maxLng - minLng);
  const spanLat = Math.abs(maxLat - minLat);
  return spanLng * spanLat > 2.2;
}

type RpcArgs = {
  min_lng: number;
  min_lat: number;
  max_lng: number;
  max_lat: number;
  max_rows: number;
  portal_filter?: string;
};

export async function loadMapListingsInBbox(
  supabase: SupabaseClient,
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number }
): Promise<{ rows: MapBboxRow[]; error?: string }> {
  const base: RpcArgs = {
    min_lng: bbox.minLng,
    min_lat: bbox.minLat,
    max_lng: bbox.maxLng,
    max_lat: bbox.maxLat,
    max_rows: MAP_LISTINGS_FETCH,
  };

  if (!isLargeMapBbox(bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat)) {
    const { data, error } = await supabase.rpc("map_listings_in_bbox", base);
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as MapBboxRow[] };
  }

  const perPortal = Math.max(40, Math.ceil(MAP_LISTINGS_LIMIT / MAP_PORTALS.length));
  const merged = new Map<string, MapBboxRow>();

  for (const portal of MAP_PORTALS) {
    const { data, error } = await supabase.rpc("map_listings_in_bbox", {
      ...base,
      max_rows: perPortal,
      portal_filter: portal,
    });
    if (error) {
      if (
        error.message.includes("portal_filter") ||
        error.message.includes("Could not find the function")
      ) {
        const fallback = await supabase.rpc("map_listings_in_bbox", base);
        if (fallback.error) return { rows: [], error: fallback.error.message };
        return { rows: (fallback.data ?? []) as MapBboxRow[] };
      }
      return { rows: [], error: error.message };
    }
    for (const row of (data ?? []) as MapBboxRow[]) {
      merged.set(row.id, row);
    }
  }

  return { rows: [...merged.values()] };
}
