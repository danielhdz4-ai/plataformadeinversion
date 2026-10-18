import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const scrapeDir = join(__dir, "../../scrape");

const DISTRICT_FILES = {
  madrid: "madrid-districts.json",
  valencia: "valencia-districts.json",
  sevilla: "sevilla-districts.json",
};

export function loadCityDistrictCatalog(citySlug) {
  const file = DISTRICT_FILES[citySlug];
  if (!file) throw new Error(`No district catalog for city: ${citySlug}`);
  return JSON.parse(readFileSync(join(scrapeDir, file), "utf8"));
}

export function listCityDistrictZones(citySlug) {
  const catalog = loadCityDistrictCatalog(citySlug);
  return (catalog.fotocasaZones ?? []).map((z) => ({
    ...z,
    kind: "district",
    citySlug: catalog.citySlug ?? citySlug,
    pisosCitySlug: catalog.pisosCitySlug ?? citySlug,
  }));
}

export function cityDistrictBatch(citySlug, batchIndex, batchSize = 40) {
  const zones = listCityDistrictZones(citySlug);
  const i = Number(batchIndex);
  const size = Number(batchSize);
  if (!Number.isFinite(i) || i < 0 || !Number.isFinite(size) || size < 1) return zones;
  return zones.slice(i * size, (i + 1) * size);
}

export function citiesWithDistrictCatalogs() {
  return Object.keys(DISTRICT_FILES);
}

/** Catálogo unificado para prefetch / rotación. */
export function allDistrictZonesFromCatalogs() {
  const out = [];
  for (const citySlug of citiesWithDistrictCatalogs()) {
    out.push(...listCityDistrictZones(citySlug));
  }
  const bcn = JSON.parse(readFileSync(join(scrapeDir, "bcn-metro.json"), "utf8"));
  for (const z of bcn.fotocasaZones ?? []) {
    out.push({ ...z, kind: "district", citySlug: "barcelona-metro" });
  }
  return out;
}
