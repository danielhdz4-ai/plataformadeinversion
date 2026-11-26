/**
 * Refresca inventario Fotocasa + pisos para barrios que solapan el polígono del scan.
 */
import { haversineKm, pointInPolygon, polygonCenterAndRadiusKm } from "./geo.mjs";
import { runFotocasaSale } from "./run-fotocasa-scrape.mjs";
import { runPisosSale } from "./run-pisos-scrape.mjs";
import { allPrefetchZones } from "./zone-catalog.mjs";

function prefetchEnabled() {
  return process.env.SCAN_PREFETCH_ENABLED !== "0";
}

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

export async function prefetchForScanPolygon(polygon) {
  if (!prefetchEnabled()) {
    return { skipped: true, reason: "disabled" };
  }

  const { lat, lng, radiusKm } = polygonCenterAndRadiusKm(polygon);
  const bufferKm = Number(process.env.SCAN_PREFETCH_BUFFER_KM ?? "2");
  const maxZones = Number(process.env.SCAN_PREFETCH_MAX_ZONES ?? "22");
  const reachKm = radiusKm + bufferKm;

  const catalog = allPrefetchZones();
  const districts = catalog.filter((z) => z.kind === "district" && z.lat != null && z.lng != null);

  const inside = districts.filter((z) => pointInPolygon(z.lng, z.lat, polygon));
  const nearby = districts
    .map((z) => ({ ...z, distKm: haversineKm(lat, lng, z.lat, z.lng) }))
    .filter((z) => z.distKm <= reachKm)
    .sort((a, b) => a.distKm - b.distKm);

  let zones = dedupeZones([
    ...inside,
    ...nearby.filter((z) => !inside.some((i) => i.slug === z.slug)),
  ]).slice(0, maxZones);

  if (zones.length === 0) {
    const city = catalog
      .filter((z) => z.kind === "city" && z.lat != null && z.lng != null)
      .map((z) => ({ ...z, distKm: haversineKm(lat, lng, z.lat, z.lng) }))
      .filter((z) => z.distKm <= 45)
      .sort((a, b) => a.distKm - b.distKm)[0];

    if (!city) {
      return { skipped: true, reason: "no_zones", center: { lat, lng, radiusKm } };
    }

    process.env.FOTOCASA_PER_ZONE = process.env.SCAN_FOTOCASA_PER_ZONE ?? "220";
    process.env.FOTOCASA_MAX_PAGES = process.env.SCAN_FOTOCASA_MAX_PAGES ?? "14";
    const fotocasa = await runFotocasaSale({
      citySlug: `scan-${city.citySlug}`,
      zones: [{ slug: city.slug, name: city.name, ccaa: city.ccaa, lat: city.lat, lng: city.lng }],
    });
    let pisos = null;
    if (city.citySlug && city.pisosCitySlug) {
      pisos = await runPisosSale(city.citySlug, {
        maxListings: Number(process.env.SCAN_PISOS_MAX ?? "400"),
        maxPages: Number(process.env.SCAN_PISOS_MAX_PAGES ?? "28"),
      });
    }
    return { mode: "city", city: city.citySlug, fotocasa, pisos, center: { lat, lng, radiusKm } };
  }

  process.env.FOTOCASA_PER_ZONE = process.env.SCAN_FOTOCASA_PER_ZONE ?? "120";
  process.env.FOTOCASA_MAX_PAGES = process.env.SCAN_FOTOCASA_MAX_PAGES ?? "10";
  const pisosPer = Number(process.env.SCAN_PISOS_PER_DISTRICT ?? "90");
  const pisosPages = Number(process.env.SCAN_PISOS_MAX_PAGES ?? "8");
  const pisosCap = Number(process.env.SCAN_PISOS_MAX_DISTRICTS ?? "10");

  const fotocasaZones = zones.map((z) => ({
    slug: z.slug,
    name: z.name,
    ccaa: z.ccaa,
    lat: z.lat,
    lng: z.lng,
  }));

  const fotocasa = await runFotocasaSale({
    citySlug: "scan-prefetch",
    zones: fotocasaZones,
  });

  const pisos = [];
  for (const z of zones.slice(0, pisosCap)) {
    const pisosCity = z.pisosCitySlug ?? z.citySlug;
    const district = z.pisosDistrict ?? z.slug?.split("/")?.pop();
    if (pisosCity && district) {
      try {
        pisos.push({
          district,
          ...(await runPisosSale(pisosCity, {
            district,
            maxListings: pisosPer,
            maxPages: pisosPages,
            fallbackLng: z.lng,
            fallbackLat: z.lat,
          })),
        });
      } catch (e) {
        pisos.push({
          district,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return {
    mode: "districts",
    zones: zones.map((z) => z.slug),
    zonesInside: inside.map((z) => z.slug),
    fotocasa,
    pisos,
    center: { lat, lng, radiusKm, reachKm },
  };
}
