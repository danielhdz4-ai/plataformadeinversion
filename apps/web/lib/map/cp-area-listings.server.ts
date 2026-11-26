import { listingWithinFreshWindow } from "@/lib/listing/opportunity-qualify";
import type { GeocodeHit } from "@/lib/map/geocode-spain";
import type { SupabaseClient } from "@supabase/supabase-js";

type RpcRow = {
  id: string;
  price: number;
  postal_code: string | null;
};

/**
 * Zona de un CP para el feed de Oportunidades.
 *
 * El `postal_code` de los anuncios se asigna por radio, así que un CP urbano
 * concreto puede quedarse sin inventario propio ("0 de 180"). La solución es
 * acotar el radio: si el CP tiene policía/polígono con bbox pequeño usamos un
 * radio menor para que el área equivalga al código postal, y si aún así no hay
 * stock ampliamos.
 */
export function cpRadiusFromBbox(
  cp: string | null | undefined,
  bbox: GeocodeHit["bbox"],
  fallbackM = 6500
): number {
  if (!bbox) return fallbackM;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const dLat = Math.abs(maxLat - minLat) * 111_000;
  const dLng = Math.abs(maxLng - minLng) * 85_000;
  const span = Math.max(dLat, dLng);
  /** Un CP urbano mide ~1–2 km; los códigos de municipio rural cubren más. */
  const byBbox = Math.min(14_000, Math.max(2500, span * 0.6 + 1200));
  return cp ? byBbox : Math.max(byBbox, fallbackM);
}

/**
 * Anuncios con bbox de CP: como mucho `maxM` del centro cuando son pocos
 * (índices urbanos etiquetan miles de inmuebles con el mismo CP).
 */
export function cpExactRadiusM(maxM: number, count: number): number {
  if (count >= 25) return maxM;
  if (count >= 8) return Math.min(maxM, 3000);
  return Math.min(maxM, 2000);
}

/** Anuncios frescos alrededor del centro del CP (sin depender del etiquetado exacto). */
export async function countFreshAround(
  supabase: SupabaseClient,
  cp: string,
  lat: number,
  lng: number,
  opts: { radiusM: number; freshDays?: number }
): Promise<{ exact: number; around: number }> {
  const { data, error } = await supabase.rpc("listings_for_postal_code", {
    p_cp: cp,
    p_lng: lng,
    p_lat: lat,
    p_radius_m: opts.radiusM,
    max_rows: 1200,
    portal_filter: null,
  });
  if (error) return { exact: 0, around: 0 };
  const rows = (data ?? []) as RpcRow[];
  return {
    exact: rows.filter((r) => r.postal_code === cp).length,
    around: rows.filter((r) => r.postal_code !== cp).length,
  };
}

export { listingWithinFreshWindow };
