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
export type MapBboxLoadOptions = {
  portals?: string[];
  priceMin?: number;
  priceMax?: number;
};

export async function loadMapListingsInBbox(
  supabase: SupabaseClient,
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number },
  options: MapBboxLoadOptions = {}
): Promise<{ rows: MapBboxRow[]; error?: string }> {
  const portalList =
    options.portals?.length ?
      MAP_PORTALS.filter((p) => options.portals!.includes(p))
    : [...MAP_PORTALS];
  const activePortals = portalList.length ? portalList : [...MAP_PORTALS];

  const defaultPerPortal = Math.max(40, Math.ceil(MAP_LISTINGS_LIMIT / activePortals.length));
  /** Más cupo a pisos.com / Kelify (suelen concentrar precios bajos). */
  const portalRowCap = (portal: string) => {
    if (portal === "pisos_com") return Math.max(defaultPerPortal, 140);
    if (portal === "kelify") return Math.max(defaultPerPortal, 100);
    return defaultPerPortal;
  };

  const merged = new Map<string, MapBboxRow>();
  let portalFilterMissing = false;

  const priceMin = options.priceMin ?? 0;
  const priceMax = options.priceMax ?? Number.MAX_SAFE_INTEGER;

  const batches = await Promise.all(
    activePortals.map(async (portal) => {
      const { data, error } = await supabase.rpc("map_listings_in_bbox", {
        min_lng: bbox.minLng,
        min_lat: bbox.minLat,
        max_lng: bbox.maxLng,
        max_lat: bbox.maxLat,
        max_rows: portalRowCap(portal),
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
      if (row.price < priceMin || row.price > priceMax) continue;
      merged.set(row.id, row);
    }
  }

  if (portalFilterMissing) {
    const { data, error } = await supabase.rpc("map_listings_in_bbox", {
      min_lng: bbox.minLng,
      min_lat: bbox.minLat,
      max_lng: bbox.maxLng,
      max_lat: bbox.maxLat,
      max_rows: MAP_LISTINGS_FETCH,
    });
    if (error) return { rows: [], error: error.message };
    const rows = ((data ?? []) as MapBboxRow[]).filter(
      (r) => r.price >= priceMin && r.price <= priceMax
    );
    return { rows };
  }

  return { rows: [...merged.values()] };
}
