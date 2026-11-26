import { haversineKm } from "./geo.mjs";

export function normalizeCp(v) {
  const s = String(v ?? "").replace(/\D/g, "").slice(0, 5);
  return s.length === 5 ? s : null;
}

export function nearAnchor(lat, lon, anchor, maxKm) {
  if (!anchor || lat == null || lon == null) return false;
  return haversineKm(anchor.lat, anchor.lng, lat, lon) <= maxKm;
}

export const SALE_PORTALS_FOR_CP = [
  "fotocasa",
  "pisos_com",
  "kelify",
  "habitaclia",
  "hipoges",
  "solvia",
  "idealista",
];
