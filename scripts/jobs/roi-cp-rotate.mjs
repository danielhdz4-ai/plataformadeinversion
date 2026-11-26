/**
 * Recálculo ROI por CP en rotación (mismo pool que scrape-cp-rotate).
 * Sin ROI los anuncios no aparecen como oportunidad en el feed.
 * Uso: BATCH_SIZE=4 node --env-file=.env.local scripts/jobs/roi-cp-rotate.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const seed = JSON.parse(readFileSync(join(root, "scripts/data/cp-priority-seed.json"), "utf8"));

const pool = [
  ...(seed.audit_gaps ?? []),
  ...(seed.rural_priority ?? []),
  ...(seed.coastal_and_tourism ?? []),
  ...(seed.tier1_capitals ?? []),
].filter((cp, i, a) => a.indexOf(cp) === i);

const explicit = process.env.CP_LIST?.split(",")
  .map((s) => s.trim().replace(/\D/g, "").slice(0, 5))
  .filter((s) => s.length === 5);
const batchSize = Number(process.env.BATCH_SIZE ?? "4");
const dayIndex = Math.floor(Date.now() / 86400000);
const start = explicit?.length ? 0 : (dayIndex * batchSize) % Math.max(1, pool.length);
const batch = explicit?.length
  ? explicit.slice(0, batchSize)
  : [...pool.slice(start), ...pool.slice(0, start)].slice(0, batchSize);

const { ensureFreshRoi } = await import("../scrapers/lib/ensure-fresh-roi.mjs");

const results = [];
for (const cp of batch) {
  try {
    const r = await ensureFreshRoi(cp);
    results.push({ cp, ...r });
    console.error(`[roi] ${cp} candidates=${r.candidates} updated=${r.updated}`);
  } catch (e) {
    results.push({ cp, error: e instanceof Error ? e.message : String(e) });
    console.error(`[roi] ${cp} error`, e);
  }
}

const updated = results.reduce((s, r) => s + (r.updated ?? 0), 0);
console.log(JSON.stringify({ ok: updated > 0 || results.length > 0, batch, updated, results }, null, 2));
process.exit(0);
