import { polygonCenterAndRadiusKm } from "./geo.mjs";

export function normalizeScanPolygonInput(raw) {
  if (!raw) return null;
  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof obj !== "object" || obj === null) return null;
  if (obj.type !== "Polygon" || !Array.isArray(obj.coordinates?.[0]) || obj.coordinates[0].length < 3) {
    return null;
  }
  return obj;
}

export function polygonGeojsonText(raw) {
  const p = normalizeScanPolygonInput(raw);
  if (!p) throw new Error("Polígono de scan inválido");
  return JSON.stringify(p);
}

/** Bbox [minLng, minLat, maxLng, maxLat] del círculo/polígono del scan (+ buffer km). */
export function polygonScanBbox(raw, bufferKm = 1.5) {
  const p = normalizeScanPolygonInput(raw);
  if (!p) return null;
  const { lat, lng, radiusKm } = polygonCenterAndRadiusKm(p);
  const r = radiusKm + bufferKm;
  const latRad = (lat * Math.PI) / 180;
  const dLat = r / 111.32;
  const dLng = r / (111.32 * Math.cos(latRad));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}
