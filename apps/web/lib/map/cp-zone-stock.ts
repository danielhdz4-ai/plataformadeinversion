/** Stock mínimo deseable por CP/zona antes de dar por satisfecha la importación. */
export const ZONE_STOCK_TARGET = 80;

export const EXPLORAR_MIN_ZOOM_FOR_BBOX = 10.5;

/**
 * Radio de búsqueda para un lugar (barrio o municipio) a partir de su bbox.
 * Barrio pequeño → ~2-4 km; municipio grande → hasta 15 km.
 */
export function radiusFromBbox(
  bbox: [number, number, number, number] | null | undefined,
  fallbackM = 6500
): number {
  if (!bbox) return fallbackM;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const dLat = Math.abs(maxLat - minLat) * 111_000;
  const dLng = Math.abs(maxLng - minLng) * 85_000;
  const span = Math.max(dLat, dLng);
  return Math.round(Math.min(15_000, Math.max(2500, span * 0.55 + 1500)));
}

export function cpRadiusSteps(baseM = 5500): number[] {
  const base = Math.min(15_000, Math.max(2500, Math.round(baseM)));
  return [
    base,
    Math.min(15_000, Math.round(base * 1.35)),
    Math.min(15_000, Math.round(base * 1.75)),
    15_000,
  ].filter((v, i, a) => a.indexOf(v) === i);
}