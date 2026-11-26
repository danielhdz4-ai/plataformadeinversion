import { haversineKm } from "./geo.mjs";
import { geocodePostalCodeSpain } from "./geocode-es.mjs";
import { allPrefetchZones } from "./zone-catalog.mjs";
import { resolveNearestCity } from "./resolve-nearest-city.mjs";
import { resolveFotocasaZoneSlug } from "./resolve-fotocasa-zone.mjs";

/** Barrios Fotocasa/pisos cercanos al centro del CP. */
export async function resolveZonesForPostalCode(postalCode) {
  const cp = String(postalCode ?? "").trim();
  if (!/^(0[1-9]\d{3}|[1-4]\d{4}|5[0-2]\d{3})$/.test(cp)) {
    throw new Error(`Código postal inválido: ${postalCode}`);
  }

  const geo = await geocodePostalCodeSpain(cp);
  if (!geo) throw new Error(`No se pudo geolocalizar CP ${cp}`);

  const anchorCity = resolveNearestCity(geo.lat, geo.lon, 120);
  const reachKm = Number(process.env.SCAN_CP_DISTRICT_KM ?? "12");
  const maxZones = Number(process.env.SCAN_CP_MAX_DISTRICTS ?? "10");

  const districts = allPrefetchZones().filter(
    (z) => z.kind === "district" && z.lat != null && z.lng != null
  );

  const nearby = districts
    .map((z) => ({ ...z, distKm: haversineKm(geo.lat, geo.lon, z.lat, z.lng) }))
    .filter((z) => z.distKm <= reachKm)
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, maxZones);

  const fotocasaZones = nearby.map((z) => ({
    slug: z.slug,
    name: z.name,
    ccaa: z.ccaa,
    lat: z.lat,
    lng: z.lng,
    distKm: z.distKm,
  }));

  /** Provincia Fotocasa por prefijo de CP (cobertura rural sin barrios). */
  const PROVINCE_BY_PREFIX = {
    "01": "araba-alava",
    "20": "gipuzkoa",
    "31": "navarra-provincia",
    "26": "la-rioja-provincia",
    "05": "avila-provincia",
    "39": "cantabria-provincia",
    "21": "huelva-provincia",
    "18": "granada-provincia",
    "25": "lleida-provincia",
  };

  if (anchorCity) {
    const primary = resolveFotocasaZoneSlug(anchorCity.citySlug) ?? anchorCity.slug;
    const hasPrimary = fotocasaZones.some((z) => z.slug === primary);
    if (!hasPrimary && fotocasaZones.length < 3) {
      fotocasaZones.push({
        slug: primary,
        name: anchorCity.name,
        ccaa: anchorCity.ccaa,
        lat: geo.lat,
        lng: geo.lon,
        distKm: 0,
      });
    }
    const provincial = PROVINCE_BY_PREFIX[cp.slice(0, 2)];
    if (provincial && !fotocasaZones.some((z) => z.slug === provincial)) {
      fotocasaZones.push({
        slug: provincial,
        name: `${anchorCity.name} (provincia)`,
        ccaa: anchorCity.ccaa,
        lat: geo.lat,
        lng: geo.lon,
        distKm: 0,
      });
    }
  }

  return {
    postalCode: cp,
    center: { lat: geo.lat, lng: geo.lon },
    anchorCity,
    zones: nearby,
    fotocasaZones,
  };
}
