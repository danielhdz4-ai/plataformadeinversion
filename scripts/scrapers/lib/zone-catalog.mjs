import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allDistrictZonesFromCatalogs } from "./city-districts.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const scrapeDir = join(__dir, "../../scrape");

function readJson(name) {
  return JSON.parse(readFileSync(join(scrapeDir, name), "utf8"));
}

/** Zonas Fotocasa/pisos con centro opcional (lat/lng). */
export function allPrefetchZones() {
  const fotocasaCitySlug = {
    barcelona: "barcelona-capital",
    madrid: "madrid-capital",
    valencia: "valencia-capital",
    sevilla: "sevilla-capital",
    malaga: "malaga-capital",
    bilbao: "bilbao",
    zaragoza: "zaragoza-capital",
    murcia: "murcia-capital",
  };

  const fixTier1Slug = (readJson("spain-locations.json").tier1 ?? []).map((c) => ({
    slug: fotocasaCitySlug[c.slug] ?? c.slug,
    name: c.name,
    ccaa: c.ccaa,
    pisosDistrict: null,
    pisosCitySlug: c.pisosSlug,
    citySlug: c.slug,
    kind: "city",
    lat: c.center?.[1] ?? (c.bbox ? (c.bbox[1] + c.bbox[3]) / 2 : null),
    lng: c.center?.[0] ?? (c.bbox ? (c.bbox[0] + c.bbox[2]) / 2 : null),
  }));

  return [...allDistrictZonesFromCatalogs(), ...fixTier1Slug];
}
