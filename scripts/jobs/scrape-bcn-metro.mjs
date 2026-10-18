/**
 * Scrape profundo área metropolitana Barcelona (venta + alquiler).
 * Objetivo: densidad tipo ROIExplorer en scans del cinturón BCN.
 *
 * Uso local:
 *   node --env-file=apps/web/.env.local scripts/jobs/scrape-bcn-metro.mjs
 *
 * Env útiles:
 *   PISOS_PER_CITY=800 FOTOCASA_PER_ZONE=350 FOTOCASA_MAX_PAGES=25
 *   HABITACLIA_PER_ZONE=120 HABITACLIA_MAX_PAGES=10 SKIP_HABITACLIA=1
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { listBcnFotocasaZones, listBcnHabitacliaZones, listBcnPisosCities } from "../scrapers/lib/bcn-metro.mjs";
import { runFotocasaSale } from "../scrapers/lib/run-fotocasa-scrape.mjs";
import { runHabitacliaSale } from "../scrapers/lib/run-habitaclia-scrape.mjs";
import { runPisosRent, runPisosSale } from "../scrapers/lib/run-pisos-scrape.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

process.env.MAX_LISTINGS = process.env.MAX_LISTINGS ?? "8000";
process.env.PISOS_MAX_PAGES = process.env.PISOS_MAX_PAGES ?? "45";
process.env.FOTOCASA_MAX_PAGES = process.env.FOTOCASA_MAX_PAGES ?? "22";
process.env.FOTOCASA_PER_ZONE = process.env.FOTOCASA_PER_ZONE ?? "350";
process.env.HABITACLIA_MAX_PAGES = process.env.HABITACLIA_MAX_PAGES ?? "8";
process.env.HABITACLIA_PER_ZONE = process.env.HABITACLIA_PER_ZONE ?? "100";
process.env.PISOS_PER_CITY = process.env.PISOS_PER_CITY ?? "700";
process.env.PAUSE_MS = process.env.PAUSE_MS ?? "650";

const results = { pisos: [], fotocasa: null, habitaclia: null, post: {} };

console.log("BCN metro scrape — pisos cities:", listBcnPisosCities().map((c) => c.slug).join(", "));
console.log("BCN metro scrape — fotocasa zones:", listBcnFotocasaZones().length);

for (const city of listBcnPisosCities()) {
  process.env.MAX_LISTINGS = process.env.PISOS_PER_CITY;
  for (const [op, fn] of [
    ["sale", runPisosSale],
    ["rent", runPisosRent],
  ]) {
    console.log(`\n>>> pisos ${op}`, city.slug);
    try {
      results.pisos.push({ op, ...(await fn(city.slug)) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`pisos ${op} skip ${city.slug}:`, msg);
      results.pisos.push({ op, city: city.slug, ok: false, error: msg });
    }
  }
}

console.log("\n>>> fotocasa venta (metro)");
results.fotocasa = await runFotocasaSale({
  zones: listBcnFotocasaZones(),
  citySlug: "bcn-metro",
});

if (process.env.SKIP_HABITACLIA !== "1") {
  console.log("\n>>> habitaclia venta (metro)");
  try {
    results.habitaclia = await runHabitacliaSale({
      zones: listBcnHabitacliaZones(),
      citySlug: "bcn-metro",
    });
  } catch (e) {
    results.habitaclia = { error: e instanceof Error ? e.message : String(e) };
    console.warn("habitaclia skipped/failed:", results.habitaclia.error);
  }
}

async function runJob(rel) {
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(root, rel)], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${rel} exit ${code}`))));
  });
}

console.log("\n>>> geocode batch (x3)");
for (let i = 0; i < 3; i++) {
  try {
    await runJob("scripts/jobs/geocode-batch.mjs");
  } catch (e) {
    console.warn("geocode batch", e.message);
  }
}

console.log("\n>>> precompute ROI + sync");
try {
  await runJob("scripts/jobs/sync-listing-roi.mjs");
} catch {
  /* optional */
}
try {
  await runJob("scripts/jobs/precompute-roi.mjs");
} catch (e) {
  console.warn("precompute", e.message);
}

console.log("\nDone BCN metro:", JSON.stringify(results, null, 2));
