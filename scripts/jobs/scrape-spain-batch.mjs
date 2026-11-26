/**
 * Scrape venta multi-portal por lote (Tier 1, Tier 2 o rotación diaria).
 *
 * Env:
 *   TIER=1|2|all
 *   BATCH_SIZE=10
 *   CITY_SLUGS=madrid,valencia (opcional, ignora rotación)
 *   MAX_LISTINGS=400
 *   PAUSE_MS=2500
 */
import { runCitySaleIngest } from "../scrapers/lib/run-city-sale-ingest.mjs";
import { runKelifySale } from "../scrapers/lib/run-kelify-scrape.mjs";
import { citiesForRotation, getCityConfig, listCities } from "../scrapers/lib/spain-city.mjs";

const pauseMs = Number(process.env.PAUSE_MS ?? "2500");
process.env.MAX_LISTINGS = process.env.MAX_LISTINGS ?? process.env.KELIFY_MAX_LISTINGS ?? "400";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const explicit = process.env.CITY_SLUGS?.split(",").map((s) => s.trim()).filter(Boolean);
let cities;
if (explicit?.length) {
  cities = explicit.map((slug) => getCityConfig(slug));
} else {
  const tier = process.env.TIER ?? "2";
  const batchSize = Number(process.env.BATCH_SIZE ?? "10");
  if (tier === "1") cities = listCities({ tier: 1 });
  else if (tier === "all") cities = listCities();
  else cities = citiesForRotation({ tier: 2, batchSize });
}

const results = [];
for (const city of cities) {
  try {
    if (process.env.KELIFY_ONLY === "1") {
      const kelify = await runKelifySale(city.slug);
      results.push({ city: city.slug, ok: true, kelify, kelifyOnly: true });
      continue;
    }

    const ingest = await runCitySaleIngest(city.slug);
    await sleep(pauseMs);

    let kelify = null;
    if (process.env.SKIP_KELIFY !== "1") {
      try {
        kelify = await runKelifySale(city.slug);
      } catch (e) {
        kelify = { error: e instanceof Error ? e.message : String(e) };
      }
      await sleep(pauseMs);
    }

    results.push({ city: city.slug, ok: ingest.ok !== false, ingest, kelify });
  } catch (e) {
    results.push({
      city: city.slug,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  await sleep(pauseMs);
}

console.log(JSON.stringify({ ok: true, batch: results.length, results }));
