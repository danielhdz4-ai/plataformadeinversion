import type { ScanPolygon } from "@/lib/scan/types";

/** Polígono aproximado de un círculo (radio km) para scans tipo ROI Explorer. */
export function circlePolygon(
  centerLng: number,
  centerLat: number,
  radiusKm: number,
  segments = 64
): ScanPolygon {
  const ring: [number, number][] = [];
  const latRad = (centerLat * Math.PI) / 180;
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos(latRad);
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    const dx = (radiusKm * Math.cos(angle)) / kmPerDegLng;
    const dy = (radiusKm * Math.sin(angle)) / kmPerDegLat;
    ring.push([centerLng + dx, centerLat + dy]);
  }
  return { type: "Polygon", coordinates: [ring] };
}

export function circleAreaKm2(radiusKm: number): number {
  return Math.PI * radiusKm * radiusKm;
}
