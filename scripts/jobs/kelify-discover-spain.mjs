/**
 * Descubre inventario Kelify venta — todas las ciudades del catálogo España.
 *
 * Env:
 *   KELIFY_MAX_LISTINGS=3000   (por ciudad)
 *   KELIFY_SCROLL_ROUNDS=45
 *   PAUSE_MS=4000
 *   CITY_SLUGS=valencia,castellon (opcional, subset)
 *   DRY_RUN=1
 */
import { runKelifySale } from "../scrapers/lib/run-kelify-scrape.mjs";
import { allKelifyCities } from "../scrapers/lib/kelify-urls.mjs";
import { getCityConfig } from "../scrapers/lib/spain-city.mjs";

process.env.MAX_LISTINGS =
  process.env.KELIFY_MAX_LISTINGS ?? process.env.MAX_LISTINGS ?? "3000";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const pauseMs = Number(process.env.PAUSE_MS ?? "4000");
const explicit = process.env.CITY_SLUGS?.split(",").map((s) => s.trim()).filter(Boolean);
const cities = explicit?.length ? explicit.map((slug) => getCityConfig(slug)) : allKelifyCities();

const results = [];
for (const city of cities) {
  try {
    const r = await runKelifySale(city.slug);
    results.push({ city: city.slug, ok: true, ...r });
  } catch (e) {
    results.push({
      city: city.slug,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  await sleep(pauseMs);
}

const ok = results.filter((r) => r.ok).length;
const cards = results.reduce((n, r) => n + (r.cards ?? 0), 0);
const inserted = results.reduce((n, r) => n + (r.inserted ?? 0), 0);
console.log(JSON.stringify({ ok: true, cities: cities.length, succeeded: ok, totalCards: cards, totalUpserted: inserted, results }));
