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
  "idealista",
  "pisos_com",
  "hipoges",
  "solvia",
  "fotocasa",
  "habitaclia",
] as const;

type RpcArgs = {
  min_lng: number;
  min_lat: number;
  max_lng: number;
  max_lat: number;
  max_rows: number;
  portal_filter?: string;
};

/** Top-N por ROI en un solo portal domina el mapa; pedimos cupo por fuente. */
export async function loadMapListingsInBbox(
  supabase: SupabaseClient,
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number }
): Promise<{ rows: MapBboxRow[]; error?: string }> {
  const perPortal = Math.max(40, Math.ceil(MAP_LISTINGS_LIMIT / MAP_PORTALS.length));
  const base: RpcArgs = {
    min_lng: bbox.minLng,
    min_lat: bbox.minLat,
    max_lng: bbox.maxLng,
    max_lat: bbox.maxLat,
    max_rows: perPortal,
  };

  const merged = new Map<string, MapBboxRow>();
  let portalFilterMissing = false;

  const batches = await Promise.all(
    MAP_PORTALS.map(async (portal) => {
      const { data, error } = await supabase.rpc("map_listings_in_bbox", {
        ...base,
        portal_filter: portal,
      });
      return { portal, data, error };
    })
  );

  for (const { data, error } of batches) {
    if (error) {
      if (
        error.message.includes("portal_filter") ||
        error.message.includes("Could not find the function")
      ) {
        portalFilterMissing = true;
        break;
      }
      return { rows: [], error: error.message };
    }
    for (const row of (data ?? []) as MapBboxRow[]) {
      merged.set(row.id, row);
    }
  }

  if (portalFilterMissing) {
    const { data, error } = await supabase.rpc("map_listings_in_bbox", {
      min_lng: base.min_lng,
      min_lat: base.min_lat,
      max_lng: base.max_lng,
      max_lat: base.max_lat,
      max_rows: MAP_LISTINGS_FETCH,
    });
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as MapBboxRow[] };
  }

  return { rows: [...merged.values()] };
}
