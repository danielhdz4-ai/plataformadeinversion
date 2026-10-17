import type { ScanPolygon } from "@/lib/scan/types";

export type MapBounds = [[number, number], [number, number]];

export function boundsFromPins(
  pins: { lng: number; lat: number }[]
): MapBounds | null {
  if (pins.length === 0) return null;
  let minLng = pins[0]!.lng;
  let maxLng = pins[0]!.lng;
  let minLat = pins[0]!.lat;
  let maxLat = pins[0]!.lat;
  for (const p of pins) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/** Bounding box [[west, south], [east, north]] para MapLibre fitBounds. */
export function polygonBounds(
  polygon: ScanPolygon
): [[number, number], [number, number]] {
  const ring = polygon.coordinates[0] ?? [];
  if (ring.length === 0) {
    return [
      [-3.7, 40.2],
      [-3.7, 40.2],
    ];
  }
  let minLng = ring[0]![0]!;
  let maxLng = ring[0]![0]!;
  let minLat = ring[0]![1]!;
  let maxLat = ring[0]![1]!;
  for (const c of ring) {
    const lng = c[0]!;
    const lat = c[1]!;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
