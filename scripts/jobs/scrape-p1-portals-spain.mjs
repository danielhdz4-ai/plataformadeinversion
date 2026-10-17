/**
 * Fotocasa + habitaclia — venta (P1).
 * Env: MAX_LISTINGS, FOTOCASA_ONLY=1, HABITACLIA_ONLY=1
 */
import { runFotocasaSale } from "../scrapers/lib/run-fotocasa-scrape.mjs";
import { runHabitacliaSale } from "../scrapers/lib/run-habitaclia-scrape.mjs";

process.env.MAX_LISTINGS = process.env.MAX_LISTINGS ?? "600";

const results = {};
if (process.env.HABITACLIA_ONLY !== "1") {
  results.fotocasa = await runFotocasaSale();
}
if (process.env.FOTOCASA_ONLY !== "1") {
  results.habitaclia = await runHabitacliaSale();
}
console.log(JSON.stringify({ ok: true, results }));
