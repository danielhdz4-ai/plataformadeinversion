/**
 * Refresca inventario Fotocasa + pisos para barrios que solapan el polígono del scan.
 * (Comportamiento tipo ROIExplorer: datos antes de rankear.)
 */
import { haversineKm, polygonCenterAndRadiusKm } from "./geo.mjs";
import { runFotocasaSale } from "./run-fotocasa-scrape.mjs";
import { runPisosSale } from "./run-pisos-scrape.mjs";
import { allPrefetchZones } from "./zone-catalog.mjs";

function prefetchEnabled() {
  return process.env.SCAN_PREFETCH_ENABLED !== "0";
}

export async function prefetchForScanPolygon(polygon) {
  if (!prefetchEnabled()) {
    return { skipped: true, reason: "disabled" };
  }

  const { lat, lng, radiusKm } = polygonCenterAndRadiusKm(polygon);
  const bufferKm = Number(process.env.SCAN_PREFETCH_BUFFER_KM ?? "1.5");
  const maxZones = Number(process.env.SCAN_PREFETCH_MAX_ZONES ?? "14");
  const reachKm = radiusKm + bufferKm;

  const catalog = allPrefetchZones();
  const districts = catalog
    .filter((z) => z.kind === "district" && z.lat != null && z.lng != null)
    .map((z) => ({ ...z, distKm: haversineKm(lat, lng, z.lat, z.lng) }))
    .filter((z) => z.distKm <= reachKm)
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, maxZones);

  let zones = districts;

  if (zones.length === 0) {
    const city = catalog
      .filter((z) => z.kind === "city" && z.lat != null && z.lng != null)
      .map((z) => ({ ...z, distKm: haversineKm(lat, lng, z.lat, z.lng) }))
      .filter((z) => z.distKm <= 40)
      .sort((a, b) => a.distKm - b.distKm)[0];

    if (!city) {
      return { skipped: true, reason: "no_zones", center: { lat, lng, radiusKm } };
    }

    process.env.FOTOCASA_PER_ZONE = process.env.SCAN_FOTOCASA_PER_ZONE ?? "200";
    process.env.FOTOCASA_MAX_PAGES = process.env.SCAN_FOTOCASA_MAX_PAGES ?? "12";
    const fotocasa = await runFotocasaSale({
      citySlug: `scan-${city.citySlug}`,
      zones: [{ slug: city.slug, name: city.name, ccaa: city.ccaa }],
    });
    let pisos = null;
    if (city.citySlug && city.pisosCitySlug) {
      pisos = await runPisosSale(city.citySlug, {
        maxListings: Number(process.env.SCAN_PISOS_MAX ?? "350"),
        maxPages: Number(process.env.SCAN_PISOS_MAX_PAGES ?? "25"),
      });
    }
    return { mode: "city", city: city.citySlug, fotocasa, pisos, center: { lat, lng, radiusKm } };
  }

  process.env.FOTOCASA_PER_ZONE = process.env.SCAN_FOTOCASA_PER_ZONE ?? "80";
  process.env.FOTOCASA_MAX_PAGES = process.env.SCAN_FOTOCASA_MAX_PAGES ?? "8";
  const pisosPer = Number(process.env.SCAN_PISOS_PER_DISTRICT ?? "55");
  const pisosPages = Number(process.env.SCAN_PISOS_MAX_PAGES ?? "6");

  const fotocasaZones = zones.map((z) => ({
    slug: z.slug,
    name: z.name,
    ccaa: z.ccaa,
  }));

  const fotocasa = await runFotocasaSale({
    citySlug: "scan-prefetch",
    zones: fotocasaZones,
  });

  const pisosCap = Number(process.env.SCAN_PISOS_MAX_DISTRICTS ?? "6");
  const pisos = [];
  const pisosCityBySlug = {
    madrid: "madrid",
    valencia: "valencia",
    sevilla: "sevilla",
  };

  for (const z of zones.slice(0, pisosCap)) {
    const pisosCity = pisosCityBySlug[z.citySlug] ?? z.pisosCitySlug;
    if (pisosCity && z.pisosDistrict) {
      try {
        pisos.push({
          district: z.pisosDistrict,
          ...(await runPisosSale(pisosCity, {
            district: z.pisosDistrict,
            maxListings: pisosPer,
            maxPages: pisosPages,
          })),
        });
      } catch (e) {
        pisos.push({
          district: z.pisosDistrict,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return {
    mode: "districts",
    zones: zones.map((z) => z.slug),
    fotocasa,
    pisos,
    center: { lat, lng, radiusKm, reachKm },
  };
}
