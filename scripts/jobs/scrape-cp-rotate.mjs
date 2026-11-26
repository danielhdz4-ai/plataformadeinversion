/**
 * Scrape venta por CP (rural + costa en rotación diaria).
 * Uso: BATCH_SIZE=8 node --env-file=.env.local scripts/jobs/scrape-cp-rotate.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const seed = JSON.parse(readFileSync(join(root, "scripts/data/cp-priority-seed.json"), "utf8"));

/**
 * Orden: huecos de auditoría → rurales → costa → capitales Tier1 (frescura 14 d).
 * Capitales al final para que un fallo de stock no bloquee el resto del lote.
 */
const pool = [
  ...(seed.audit_gaps ?? []),
  ...(seed.rural_priority ?? []),
  ...(seed.coastal_and_tourism ?? []),
  ...(seed.tier1_capitals ?? []),
].filter((cp, i, a) => a.indexOf(cp) === i);

const explicit = process.env.CP_LIST?.split(",")
  .map((s) => s.trim().replace(/\D/g, "").slice(0, 5))
  .filter((s) => s.length === 5);

const batchSize = Number(process.env.BATCH_SIZE ?? "8");
const pauseMs = Number(process.env.PAUSE_MS ?? "4000");

const dayIndex = Math.floor(Date.now() / 86400000);
const start = explicit?.length
  ? 0
  : (dayIndex * batchSize) % Math.max(1, pool.length);

const batch = explicit?.length
  ? explicit.slice(0, batchSize)
  : [...pool.slice(start), ...pool.slice(0, start)].slice(0, batchSize);

const { scrapeByPostalCode } = await import("../scrapers/lib/scrape-by-postal-code.mjs");

const results = [];
for (const cp of batch) {
  try {
    const r = await scrapeByPostalCode(cp, { force: true });
    results.push({ cp, ...r });
  } catch (e) {
    results.push({
      cp,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  await new Promise((r) => setTimeout(r, pauseMs));
}

const stockTarget = Number(process.env.ZONE_STOCK_TARGET ?? "80");
const okCount = results.filter(
  (r) => (r.countAfter ?? 0) >= stockTarget || r.meetsTarget
).length;
const withRoi = results.filter((r) => (r.roi?.updated ?? 0) > 0);
console.log(
  JSON.stringify(
    {
      ok: okCount >= 1,
      stockOk: okCount,
      roiUpdated: withRoi.reduce((s, r) => s + r.roi.updated, 0),
      poolSize: pool.length,
      batch,
      results,
    },
    null,
    2
  )
);
process.exit(okCount >= 1 ? 0 : 1);