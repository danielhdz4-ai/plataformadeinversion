/**
 * Scrape de ALQUILER (comparables de renta para el ROI) por ciudad.
 *
 * Los comparables de alquiler son el input más crítico del ROI: sin ellos el
 * motor cae a `rent_benchmarks` o a un heurístico ciego. Este job mantiene
 * fresco el stock de alquiler de las ciudades donde hay más venta.
 *
 * Env:
 *   CITY_SLUGS=madrid,barcelona   (opcional; por defecto Tier 1)
 *   TIER=1|all                    (default 1)
 *   MAX_LISTINGS=160              (por ciudad)
 *   PISOS_MAX_PAGES=8             (por ciudad)
 *   PAUSE_MS=2000
 */
import { runPisosRent } from "../scrapers/lib/run-pisos-scrape.mjs";
import { listCities } from "../scrapers/lib/spain-city.mjs";

const pauseMs = Number(process.env.PAUSE_MS ?? "2000");
process.env.MAX_LISTINGS = process.env.MAX_LISTINGS ?? "160";
process.env.PISOS_MAX_PAGES = process.env.PISOS_MAX_PAGES ?? "8";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const explicit = process.env.CITY_SLUGS?.split(",").map((s) => s.trim()).filter(Boolean);
const cities = explicit?.length
  ? explicit
  : listCities({ tier: process.env.TIER === "all" ? undefined : 1 }).map((c) => c.slug);

const results = [];
let totalInserted = 0;
for (const slug of cities) {
  if (process.env.SKIP_PISOS_SLUGS?.split(",").includes(slug)) {
    results.push({ city: slug, skipped: true });
    continue;
  }
  try {
    const r = await runPisosRent(slug);
    totalInserted += r.inserted ?? 0;
    results.push({ city: slug, ok: true, inserted: r.inserted ?? 0 });
  } catch (e) {
    results.push({ city: slug, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
  await sleep(pauseMs);
}

console.log(JSON.stringify({ ok: true, cities: cities.length, totalInserted, results }));
