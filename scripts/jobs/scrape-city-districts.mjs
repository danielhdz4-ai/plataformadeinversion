/**
 * Scrape continuo por barrios (Fotocasa + pisos + Idealista opcional).
 *
 * Env:
 *   CITY_SLUG=madrid|valencia|sevilla
 *   DISTRICT_BATCH=0
 *   DISTRICT_BATCH_SIZE=40
 *   FOTOCASA_PER_ZONE=55
 *   FOTOCASA_MAX_PAGES=6
 *   PISOS_PER_DISTRICT=45
 *   PISOS_MAX_PAGES=5
 *   IDEALISTA_ENABLED=1
 *   IDEALISTA_PER_DISTRICT=80
 *   ARCHIVE_STALE=1
 */
import { cityDistrictBatch, loadCityDistrictCatalog } from "../scrapers/lib/city-districts.mjs";
import { runFotocasaSale } from "../scrapers/lib/run-fotocasa-scrape.mjs";
import { runIdealistaDistrictSale } from "../scrapers/lib/run-idealista-scrape.mjs";
import { runPisosSale } from "../scrapers/lib/run-pisos-scrape.mjs";
import { archiveUnseenInZone } from "../scrapers/lib/stale-zone-archive.mjs";
import { getSupabase } from "../scrapers/lib/env.mjs";

const citySlug = process.env.CITY_SLUG ?? "madrid";
const batchIdx = process.env.DISTRICT_BATCH ?? "0";
const batchSize = Number(process.env.DISTRICT_BATCH_SIZE ?? "40");
const zones = cityDistrictBatch(citySlug, batchIdx, batchSize);
const catalog = loadCityDistrictCatalog(citySlug);
const pisosCity = catalog.pisosCitySlug ?? citySlug;

if (zones.length === 0) {
  console.log(JSON.stringify({ ok: true, skipped: true, citySlug, batchIdx }));
  process.exit(0);
}

process.env.FOTOCASA_PER_ZONE = process.env.FOTOCASA_PER_ZONE ?? "55";
process.env.FOTOCASA_MAX_PAGES = process.env.FOTOCASA_MAX_PAGES ?? "6";
const pisosPer = Number(process.env.PISOS_PER_DISTRICT ?? "45");
const pisosPages = Number(process.env.PISOS_MAX_PAGES ?? "5");
const idealistaOn = process.env.IDEALISTA_ENABLED !== "0";
const archiveStale = process.env.ARCHIVE_STALE !== "0";
const supabase = getSupabase();

const results = { citySlug, batchIdx, zones: zones.length, fotocasa: null, pisos: [], idealista: [], archive: [] };

console.log(`City districts ${citySlug} batch ${batchIdx}:`, zones.length, "zones");

results.fotocasa = await runFotocasaSale({
  citySlug: `${citySlug}-districts-${batchIdx}`,
  zones: zones.map((z) => ({ slug: z.slug, name: z.name, ccaa: z.ccaa })),
});

for (const z of zones) {
  const district = z.pisosDistrict ?? z.slug.split("/").pop();
  const zoneCenter =
    z.lat != null && z.lng != null ? { lat: z.lat, lng: z.lng } : null;
  const seenPisos = new Set();
  const seenIdealista = new Set();

  try {
    const pisos = await runPisosSale(pisosCity, {
      district,
      maxListings: pisosPer,
      maxPages: pisosPages,
    });
    results.pisos.push({ district, ...pisos });
    if (pisos?.externalIds) for (const id of pisos.externalIds) seenPisos.add(String(id));
  } catch (e) {
    results.pisos.push({
      district,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  if (idealistaOn) {
    try {
      const idealista = await runIdealistaDistrictSale({
        citySlug,
        districtSlug: district,
        zoneName: z.name,
        ccaa: z.ccaa,
      });
      results.idealista.push({ district, ...idealista });
      if (idealista?.externalIds) for (const id of idealista.externalIds) seenIdealista.add(String(id));
    } catch (e) {
      results.idealista.push({
        district,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (archiveStale && zoneCenter) {
    for (const [portal, seen] of [
      ["pisos_com", seenPisos],
      ["idealista", seenIdealista],
    ]) {
      if (seen.size === 0) continue;
      results.archive.push({
        district,
        portal,
        ...(await archiveUnseenInZone(supabase, {
          sourcePortal: portal,
          cityName: z.name,
          zoneCenter,
          seenExternalIds: seen,
        })),
      });
    }
  }
}

console.log(JSON.stringify({ ok: true, results }));
