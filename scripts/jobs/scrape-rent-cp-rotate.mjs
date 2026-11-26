/**
 * Scrape de alquiler (comparables de ROI) por CP.
 * Uso: CP_LIST=28033,08001 node --env-file=.env.local scripts/jobs/scrape-rent-cp-rotate.mjs
 */
import { getSupabase } from "../scrapers/lib/env.mjs";
import { resolveZonesForPostalCode } from "../scrapers/lib/resolve-zones-for-postal-code.mjs";
import { runPisosRent } from "../scrapers/lib/run-pisos-scrape.mjs";

const explicit = process.env.CP_LIST?.split(",")
  .map((s) => s.trim().replace(/\D/g, "").slice(0, 5))
  .filter((s) => s.length === 5);

if (!explicit?.length) {
  console.error("CP_LIST requerido (lista de CP separados por coma)");
  process.exit(2);
}

process.env.MAX_LISTINGS = process.env.MAX_LISTINGS ?? "60";
process.env.PISOS_MAX_PAGES = process.env.PISOS_MAX_PAGES ?? "4";
const pauseMs = Number(process.env.PAUSE_MS ?? "2500");

// Cliente compartido (env.mjs) para validar credenciales antes de scrapear.
getSupabase();

const done = new Set();
const results = [];

for (const cp of explicit) {
  try {
    const resolved = await resolveZonesForPostalCode(cp);
    const slug = resolved.anchorCity?.citySlug;
    if (!slug) {
      results.push({ cp, ok: false, error: "no_anchor_city" });
    } else if (done.has(slug)) {
      results.push({ cp, ok: true, slug, skipped: "ciudad_ya_scrapeada" });
    } else {
      done.add(slug);
      const r = await runPisosRent(slug);
      results.push({ cp, slug, ok: true, inserted: r.inserted ?? 0 });
    }
  } catch (e) {
    results.push({ cp, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
  await new Promise((r) => setTimeout(r, pauseMs));
}

const totalInserted = results.reduce((s, r) => s + (r.inserted ?? 0), 0);
console.log(
  JSON.stringify({ ok: true, cps: explicit.length, cities: done.size, totalInserted, results })
);
process.exit(0);
