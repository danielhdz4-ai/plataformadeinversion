/**
 * Scrape profundo para CP débiles (auditoría 5/5 stock).
 * node --env-file=.env.local scripts/ops/backfill-audit-weak-cp.mjs
 * CP_LIST=18411,05267 BATCH_SIZE=3
 *
 * Mide stock FRESCO (scraped_at ≤ FRESH_DAYS, default 14) vía RPC listings_for_postal_code,
 * que es el mismo criterio que usa el feed de Oportunidades.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const seed = JSON.parse(readFileSync(join(root, "scripts/data/cp-priority-seed.json"), "utf8"));

const defaultList = seed.audit_gaps ?? [];
const explicit = process.env.CP_LIST?.split(",")
  .map((s) => s.trim().replace(/\D/g, "").slice(0, 5))
  .filter((s) => s.length === 5);
const list = (explicit?.length ? explicit : defaultList).slice(
  0,
  Number(process.env.BATCH_SIZE ?? defaultList.length)
);

const FRESH_DAYS = Number(process.env.FRESH_DAYS ?? "14");
const STOCK_TARGET = Number(process.env.ZONE_STOCK_TARGET ?? "80");
const RADIUS_STEPS = [5500, 9000, 12000];

process.env.SCAN_CP_DISTRICT_KM ??= "22";
process.env.SCRAPE_CP_BOOST_ROUNDS ??= "5";
process.env.SCRAPE_CP_TAG_RADIUS_M ??= "7500";
process.env.ZONE_STOCK_TARGET = String(STOCK_TARGET);

const { scrapeByPostalCode } = await import("../scrapers/lib/scrape-by-postal-code.mjs");
const { ensureFreshRoi } = await import("../scrapers/lib/ensure-fresh-roi.mjs");

const { countFreshInCp } = await import("./count-fresh-in-cp.mjs");

const results = [];
for (const cp of list) {
  const t0 = Date.now();
  try {
    const r = await scrapeByPostalCode(cp, { force: true, target: 120 });
    const stock = await countFreshInCp(cp);
    const row = { cp, ms: Date.now() - t0, ...r, fresh: stock.fresh, freshError: stock.error };
    results.push(row);
    console.error(
      `[ok] ${cp} total=${r.countAfter} fresh=${stock.fresh} nearby=${r.nearby?.nearby ?? 0}`
    );
  } catch (e) {
    results.push({
      cp,
      ms: Date.now() - t0,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
    console.error(`[err] ${cp}`, e);
  }
}

const hit = results.filter((r) => (r.fresh ?? 0) >= STOCK_TARGET).length;
const above = results.filter((r) => (r.fresh ?? 0) >= 25).length;
console.log(
  JSON.stringify({ list, stockTarget: STOCK_TARGET, freshDays: FRESH_DAYS, hit, above, results }, null, 2)
);
process.exit(above >= 1 ? 0 : 1);
