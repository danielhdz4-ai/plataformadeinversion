import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getBcnPisosCity, listBcnPisosCities } from "./bcn-metro.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(join(__dir, "../../scrape/spain-locations.json"), "utf8")
);

function bboxFromCity(raw) {
  if (raw.bbox) return raw.bbox;
  const [lng, lat] = raw.center;
  const d = raw.bboxDelta ?? 0.07;
  return [lng - d, lat - d, lng + d, lat + d];
}

function normalizeCity(raw) {
  return {
    slug: raw.slug,
    name: raw.name,
    ccaa: raw.ccaa,
    pisosSlug: raw.pisosSlug,
    pisosSkip: Boolean(raw.pisosSkip),
    kelifySlug: raw.kelifySlug ?? raw.slug,
    bbox: bboxFromCity(raw),
    regionPattern: raw.regionPattern ?? null,
    tier: raw.tier ?? 2,
  };
}

const tier1 = (catalog.tier1 ?? []).map((c) => normalizeCity({ ...c, tier: 1 }));
const tier2 = (catalog.tier2 ?? []).map((c) => normalizeCity({ ...c, tier: 2 }));

export function listCities({ tier } = {}) {
  if (tier === 1) return tier1;
  if (tier === 2) return tier2;
  return [...tier1, ...tier2];
}

export function getCityConfig(slug) {
  const city = listCities().find((c) => c.slug === slug);
  if (city) return city;
  const bcn = listBcnPisosCities().find((c) => c.slug === slug);
  if (bcn) return bcn;
  if (slug === "barcelona-metro") return getBcnPisosCity("barcelona-metro");
  throw new Error(`Unknown CITY_SLUG: ${slug}`);
}

/** Lote rotativo para no saturar Actions (p. ej. 10 ciudades/día). */
export function citiesForRotation({ tier = 2, batchSize = 10, dayOffset } = {}) {
  const pool = listCities({ tier: tier === "all" ? undefined : tier });
  const size = Math.min(batchSize, pool.length);
  const day =
    dayOffset ??
    Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const start = (day * size) % pool.length;
  const out = [];
  for (let i = 0; i < size; i++) {
    out.push(pool[(start + i) % pool.length]);
  }
  return out;
}
