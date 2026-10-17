/**
 * Hipoges + Solvia — venta residencial España.
 *
 * Env:
 *   MAX_LISTINGS=500
 *   HIPOGES_ONLY=1 | SOLVIA_ONLY=1
 *   SOLVIA_PROVINCE_IDS=28,8 (opcional)
 */
import { runHipogesSale } from "../scrapers/lib/run-hipoges-scrape.mjs";
import { runSolviaSale } from "../scrapers/lib/run-solvia-scrape.mjs";

process.env.MAX_LISTINGS = process.env.MAX_LISTINGS ?? "1500";

const results = {};
if (process.env.SOLVIA_ONLY !== "1") {
  results.hipoges = await runHipogesSale();
}
if (process.env.HIPOGES_ONLY !== "1") {
  results.solvia = await runSolviaSale();
}
console.log(JSON.stringify({ ok: true, results }));
