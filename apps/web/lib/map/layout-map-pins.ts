export type MapPinLike = {
  id: string;
  lng: number;
  lat: number;
  roi: number | null;
};

/** Evita montañas de pins cuando muchos anuncios comparten geocodificación. */
export function layoutMapPins<T extends MapPinLike>(
  pins: T[],
  opts: { max: number; zoom: number }
): T[] {
  const max =
    opts.zoom >= 14 ? opts.max : opts.zoom >= 12 ? Math.min(opts.max, 56) : Math.min(opts.max, 28);

  const sorted = [...pins].sort((a, b) => {
    const ar = a.roi ?? -1;
    const br = b.roi ?? -1;
    return br - ar;
  });

  const precision = opts.zoom >= 13 ? 5 : 4;
  const buckets = new Map<string, number>();

  const out: T[] = [];
  for (const p of sorted) {
    if (out.length >= max) break;
    const key = `${p.lng.toFixed(precision)},${p.lat.toFixed(precision)}`;
    const n = buckets.get(key) ?? 0;
    buckets.set(key, n + 1);
    if (n === 0) {
      out.push(p);
      continue;
    }
    const angle = (n * 137.508 * Math.PI) / 180;
    const meters = 18 + n * 10;
    const latRad = (p.lat * Math.PI) / 180;
    const dLng = ((meters * Math.cos(angle)) / 111_320 / Math.cos(latRad)) * 1;
    const dLat = (meters * Math.sin(angle)) / 111_320;
    out.push({ ...p, lng: p.lng + dLng, lat: p.lat + dLat });
  }
  return out;
}
