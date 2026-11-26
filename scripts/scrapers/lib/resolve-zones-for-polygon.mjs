import { haversineKm, pointInPolygon, polygonCenterAndRadiusKm } from "./geo.mjs";
import { allPrefetchZones } from "./zone-catalog.mjs";
import { resolveNearestCity } from "./resolve-nearest-city.mjs";

function dedupeZones(zones) {
  const seen = new Set();
  const out = [];
  for (const z of zones) {
    const k = z.slug ?? `${z.citySlug}/${z.name}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(z);
  }
  return out;
}

/** Barrios del catálogo + ciudad ancla (toda España Tier 1/2). */
export function resolveZonesForPolygon(polygon, options = {}) {
  const bufferKm = Number(options.bufferKm ?? process.env.SCAN_PREFETCH_BUFFER_KM ?? "3");
  const maxZones = Number(options.maxZones ?? process.env.SCAN_PREFETCH_MAX_ZONES ?? "28");
  const { lat, lng, radiusKm } = polygonCenterAndRadiusKm(polygon);
  const reachKm = radiusKm + bufferKm;

  const catalog = allPrefetchZones();
  const districts = catalog.filter((z) => z.kind === "district" && z.lat != null && z.lng != null);

  const inside = districts.filter((z) => pointInPolygon(z.lng, z.lat, polygon));
  const nearby = districts
    .map((z) => ({ ...z, distKm: haversineKm(lat, lng, z.lat, z.lng) }))
    .filter((z) => z.distKm <= reachKm)
    .sort((a, b) => a.distKm - b.distKm);

  const districtZones = dedupeZones([
    ...inside,
    ...nearby.filter((z) => !inside.some((i) => i.slug === z.slug)),
  ]).slice(0, maxZones);

  const anchorCity = resolveNearestCity(lat, lng);

  if (districtZones.length > 0) {
    return {
      mode: "districts",
      zones: districtZones,
      anchorCity,
      center: { lat, lng, radiusKm, reachKm },
      insideCount: inside.length,
    };
  }

  if (anchorCity) {
    return {
      mode: "city",
      zones: [anchorCity],
      anchorCity,
      center: { lat, lng, radiusKm, reachKm },
      insideCount: 0,
    };
  }

  return {
    mode: "none",
    zones: [],
    anchorCity: null,
    center: { lat, lng, radiusKm, reachKm },
    insideCount: 0,
  };
}
