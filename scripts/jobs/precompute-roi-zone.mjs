/**
 * Precompute ROI para los anuncios de un CP/zona (fresco, sin ROI o desactualizado).
 * Uso:
 *   CP_LIST=01001,20001 node --env-file=.env.local scripts/jobs/precompute-roi-zone.mjs
 *   CP_LIST=18411 FRESH_DAYS=14 MAX=400 node --env-file=.env.local scripts/jobs/precompute-roi-zone.mjs
 *
 * Sin ROIs el feed de Oportunidades se queda casi vacío aunque haya cientos de anuncios.
 */
import { createClient } from "@supabase/supabase-js";
import { capRentEstForSalePrice } from "../scrapers/lib/rent-cap.mjs";
import { isPlausibleMonthlyRent } from "../scrapers/lib/rent-plausible.mjs";
import { listCities } from "../scrapers/lib/spain-city.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);
const cityCatalog = listCities();

const cps = (process.env.CP_LIST ?? process.env.POSTAL_CODE ?? "")
  .split(",")
  .map((s) => s.replace(/\D/g, "").slice(0, 5))
  .filter((s) => s.length === 5);
if (cps.length === 0) {
  console.error("Indica CP_LIST=04100,08001 …");
  process.exit(1);
}

const FRESH_DAYS = Number(process.env.FRESH_DAYS ?? "14");
const MAX_PER_CP = Number(process.env.MAX ?? "400");
const RECHECK_DAYS = Number(process.env.RECHECK_DAYS ?? "7");
const CONCURRENCY = Math.min(12, Math.max(1, Number(process.env.ROI_CONCURRENCY ?? "6")));

function citySlugFromListing(cityText) {
  if (!cityText) return null;
  const lower = cityText.toLowerCase();
  for (const city of cityCatalog) {
    const filter = (city.regionPattern ?? city.name.split(" ")[0] ?? city.name).toLowerCase();
    if (lower.includes(filter)) return city.slug;
  }
  return null;
}

async function loadRentBenchmarks() {
  const { data } = await supabase.from("rent_benchmarks").select("city_slug, eur_per_sqm_month");
  return new Map((data ?? []).map((r) => [r.city_slug, Number(r.eur_per_sqm_month)]));
}

async function loadAllRentComps() {
  const all = [];
  let offset = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("listings")
      .select("price, sqm, bedrooms")
      .eq("operation", "rent")
      .eq("status", "active")
      .range(offset, offset + page - 1);
    if (error) break;
    if (!data?.length) break;
    for (const row of data) {
      if (isPlausibleMonthlyRent(row.price)) all.push(row);
    }
    offset += data.length;
    if (data.length < page) break;
  }
  return all;
}

function benchmarkRent(sale, benchmarkMap) {
  const slug = citySlugFromListing(sale.city);
  if (!slug) return null;
  const eurSqm = benchmarkMap.get(slug);
  const sqm = Number(sale.sqm);
  if (!eurSqm || !Number.isFinite(sqm) || sqm < 12) return null;
  const rentEst = capRentEstForSalePrice(Math.round(sqm * eurSqm * 0.85), Number(sale.price));
  if (rentEst == null) return null;
  return { rentEst, confidence: "low", comparablesCount: 0 };
}

function heuristicRent(sale, compsGlobal) {
  const sqm = Number(sale.sqm) || 60;
  const beds = sale.bedrooms ?? 2;
  const comps = compsGlobal.filter(
    (r) => Math.abs((r.bedrooms ?? 2) - beds) <= 1 && Math.abs(Number(r.sqm || 60) - sqm) <= 20
  );
  const rentsEur = comps.map((c) => Number(c.price)).filter(isPlausibleMonthlyRent);
  let rentEst = rentsEur.length
    ? rentsEur.sort((a, b) => a - b)[Math.floor(rentsEur.length / 2)] * 0.85
    : Math.min(sqm * 14, sqm * 19 * 0.45);
  rentEst = capRentEstForSalePrice(Math.round(rentEst), sale.price) ?? null;
  if (rentEst == null) return null;
  const n = rentsEur.length;
  return { rentEst, confidence: n >= 5 ? "medium" : "low", comparablesCount: Math.min(n, 12) };
}

async function upsertInvestment(saleId, price, rentEst, confidence, comparablesCount) {
  const capped = capRentEstForSalePrice(rentEst, price);
  if (capped == null) return false;
  const roi = (capped * 12) / Number(price);
  const { error } = await supabase.from("listing_investment").upsert(
    {
      listing_id: saleId,
      rent_est: capped,
      rent_confidence: confidence,
      comparables_count: comparablesCount,
      roi_gross: Math.round(roi * 100 * 1000) / 1000,
      computed_at: new Date().toISOString(),
    },
    { onConflict: "listing_id" }
  );
  return !error;
}

async function computeOne(sale, globalRents, benchmarkMap) {
  const price = Number(sale.price);
  if (!Number.isFinite(price) || price < 25_000) return { ok: false };

  const { data: near, error: nearErr } = await supabase.rpc("rent_comparables_near", {
    p_listing_id: sale.id,
    max_m: 800,
    lim: 12,
  });

  if (!nearErr && near?.length) {
    const rentsEur = near.map((c) => Number(c.price)).filter(isPlausibleMonthlyRent);
    const sorted = rentsEur.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? sorted[0];
    let rentEst = Math.round(median * 0.92);
    if (near.length < 4) {
      rentEst = capRentEstForSalePrice(rentEst, price);
      if (rentEst == null) return { ok: false };
    }
    const confidence = near.length >= 8 ? "high" : near.length >= 4 ? "medium" : "low";
    const ok = await upsertInvestment(sale.id, price, rentEst, confidence, near.length);
    return { ok, spatial: true };
  }

  const r0 = benchmarkRent(sale, benchmarkMap);
  if (r0) {
    const ok = await upsertInvestment(sale.id, price, r0.rentEst, r0.confidence, 0);
    return { ok, spatial: false, r0: true };
  }

  const h = heuristicRent(sale, globalRents);
  if (!h) return { ok: false };
  const ok = await upsertInvestment(sale.id, price, h.rentEst, h.confidence, h.comparablesCount);
  return { ok, spatial: false };
}

async function mapPool(items, fn, limit) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function loadCandidates(cp) {
  const cutoff = new Date(Date.now() - FRESH_DAYS * 86400000).toISOString();
  const recheck = new Date(Date.now() - RECHECK_DAYS * 86400000).toISOString();
  const { data: sales, error } = await supabase
    .from("listings")
    .select("id, price, sqm, bedrooms, city, scraped_at, listing_investment(roi_gross, computed_at)")
    .eq("postal_code", cp)
    .eq("operation", "sale")
    .eq("status", "active")
    .gte("scraped_at", cutoff)
    .not("price", "is", null)
    .limit(MAX_PER_CP);
  if (error) throw error;
  return (sales ?? []).filter((s) => {
    const inv = Array.isArray(s.listing_investment) ? s.listing_investment[0] : s.listing_investment;
    if (!inv) return true;
    if (inv.roi_gross == null) return true;
    const computed = inv.computed_at ? String(inv.computed_at) : null;
    return !computed || computed < recheck;
  });
}

const [globalRents, benchmarkMap] = await Promise.all([loadAllRentComps(), loadRentBenchmarks()]);
const summary = { cps, freshDays: FRESH_DAYS, perCp: [], rentCompsLoaded: globalRents.length };

for (const cp of cps) {
  const candidates = await loadCandidates(cp);
  const outcomes = await mapPool(
    candidates,
    (s) => computeOne(s, globalRents, benchmarkMap),
    CONCURRENCY
  );
  summary.perCp.push({
    cp,
    candidates: candidates.length,
    updated: outcomes.filter((o) => o?.ok).length,
    spatial: outcomes.filter((o) => o?.spatial).length,
    benchmark: outcomes.filter((o) => o?.r0).length,
  });
}

console.log(JSON.stringify({ ok: true, ...summary }, null, 2));
