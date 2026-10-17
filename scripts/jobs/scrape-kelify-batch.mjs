/**
 * Kelify venta — Tier 1 por defecto. CITY_SLUGS o TIER=1.
 */
import { runKelifySale } from "../scrapers/lib/run-kelify-scrape.mjs";
import { getCityConfig, listCities } from "../scrapers/lib/spain-city.mjs";

const pauseMs = Number(process.env.PAUSE_MS ?? "4000");
const explicit = process.env.CITY_SLUGS?.split(",").map((s) => s.trim()).filter(Boolean);

const cities = explicit?.length
  ? explicit.map((s) => getCityConfig(s))
  : listCities({ tier: process.env.TIER === "2" ? 2 : 1 });

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
  await new Promise((r) => setTimeout(r, pauseMs));
}

console.log(JSON.stringify({ ok: true, results }));
