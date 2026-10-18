/**
 * Elige ciudad + lote según ROTATION_SLOT (0..∞).
 */
import { citiesWithDistrictCatalogs, cityDistrictBatch, listCityDistrictZones } from "../scrapers/lib/city-districts.mjs";

const batchSize = Number(process.env.DISTRICT_BATCH_SIZE ?? "35");
const slot = Number(
  process.env.ROTATION_SLOT ?? Math.floor(Date.now() / (4 * 3600 * 1000))
);

const plan = [];
for (const city of citiesWithDistrictCatalogs()) {
  const total = listCityDistrictZones(city).length;
  const batches = Math.ceil(total / batchSize) || 1;
  for (let b = 0; b < batches; b++) {
    plan.push({ city, batch: b });
  }
}

if (plan.length === 0) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: "no catalogs" }));
  process.exit(0);
}

const pick = plan[slot % plan.length];
process.env.CITY_SLUG = pick.city;
process.env.DISTRICT_BATCH = String(pick.batch);
process.env.DISTRICT_BATCH_SIZE = String(batchSize);

console.log(JSON.stringify({ rotate: true, slot, pick, planSize: plan.length }));
await import("./scrape-city-districts.mjs");
