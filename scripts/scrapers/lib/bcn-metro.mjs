import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(join(__dir, "../../scrape/bcn-metro.json"), "utf8")
);

export function listBcnFotocasaZones() {
  return catalog.fotocasaZones ?? [];
}

export function listBcnPisosCities() {
  return (catalog.pisosCities ?? []).map((c) => ({
    slug: c.slug,
    name: c.name,
    ccaa: c.ccaa,
    pisosSlug: c.pisosSlug,
    pisosSkip: false,
    kelifySlug: c.slug,
    bbox: c.bbox,
    regionPattern: c.regionPattern ?? null,
    tier: c.tier ?? 2,
  }));
}

export function listBcnHabitacliaZones() {
  return catalog.habitacliaZones ?? [];
}

export function getBcnPisosCity(slug) {
  const c = listBcnPisosCities().find((x) => x.slug === slug);
  if (!c) throw new Error(`Unknown BCN pisos slug: ${slug}`);
  return c;
}
