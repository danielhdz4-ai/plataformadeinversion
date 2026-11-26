/**
 * Asegura ROI (listing_investment) para los anuncios frescos de un CP tras importar.
 * Sin esto el feed de Oportunidades queda casi vacío aunque haya cientos de anuncios:
 * la mayoría de recién insertados no tienen roi_gross.
 */
import { createClient } from "@supabase/supabase-js";
import { capRentEstForSalePrice } from "./rent-cap.mjs";
import { isPlausibleMonthlyRent } from "./rent-plausible.mjs";
import { listCities } from "./spain-city.mjs";

const cityCatalog = listCities();

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function citySlugFromListing(cityText) {
  if (!cityText) return null;
  const lower = cityText.toLowerCase();
  for (const city of cityCatalog) {
    const filter = (city.regionPattern ?? city.name.split(" ")[0] ?? city.name).toLowerCase();
    if (lower.includes(filter)) return city.slug;
  }
  return null;
}

async function loadRentBenchmarks(supabase, cache) {
  if (cache.map) return cache.map;
  const { data } = await supabase.from("rent_benchmarks").select("city_slug, eur_per_sqm_month");
  cache.map = new Map((data ?? []).map((r) => [r.city_slug, Number(r.eur_per_sqm_month)]));
  return cache.map;
}

async function loadRentComps(supabase, cache) {
  if (cache.comps) return cache.comps;
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
    if (error || !data?.length) break;
    for (const row of data) {
      if (isPlausibleMonthlyRent(row.price)) all.push(row);
    }
    offset += data.length;
    if (data.length < page) break;
  }
  cache.comps = all;
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

async function upsertInvestment(supabase, saleId, price, rentEst, confidence, comparablesCount) {
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

/**
 * Recalcula ROI de anuncios frescos del CP sin ROI o con ROI caducado.
 * Devuelve { candidates, updated, skipped } sin lanzar si falta config.
 */
export async function ensureFreshRoi(cpInput, options = {}) {
  const cp = String(cpInput ?? "").replace(/\D/g, "").slice(0, 5);
  if (cp.length !== 5) return { candidates: 0, updated: 0, skipped: "invalid_cp" };
  if (process.env.SCRAPE_ROI_ENSURE_ENABLED === "0") {
    return { candidates: 0, updated: 0, skipped: "disabled" };
  }

  const supabase = client();
  if (!supabase) return { candidates: 0, updated: 0, skipped: "no_client" };

  const freshDays = Number(options.freshDays ?? process.env.FRESH_DAYS ?? "14");
  const max = Number(options.max ?? process.env.SCRAPE_ROI_MAX_PER_CP ?? "400");
  const recheckDays = Number(options.recheckDays ?? process.env.SCRAPE_ROI_RECHECK_DAYS ?? "7");
  const concurrency = Math.min(12, Math.max(1, Number(process.env.ROI_CONCURRENCY ?? "6")));

  const cutoff = new Date(Date.now() - freshDays * 86400000).toISOString();
  const recheck = new Date(Date.now() - recheckDays * 86400000).toISOString();

  const { data: sales, error } = await supabase
    .from("listings")
    .select("id, price, sqm, bedrooms, city, listing_investment(roi_gross, computed_at)")
    .eq("postal_code", cp)
    .eq("operation", "sale")
    .eq("status", "active")
    .gte("scraped_at", cutoff)
    .not("price", "is", null)
    .limit(max);
  if (error) return { candidates: 0, updated: 0, skipped: error.message };

  const candidates = (sales ?? []).filter((s) => {
    const inv = Array.isArray(s.listing_investment) ? s.listing_investment[0] : s.listing_investment;
    if (!inv || inv.roi_gross == null) return true;
    const computed = inv.computed_at ? String(inv.computed_at) : null;
    return !computed || computed < recheck;
  });
  if (candidates.length === 0) return { candidates: 0, updated: 0 };

  const cache = {};
  const [benchmarkMap, comps] = await Promise.all([
    loadRentBenchmarks(supabase, cache),
    loadRentComps(supabase, cache),
  ]);

  const outcomes = await mapPool(
    candidates,
    async (sale) => {
      const price = Number(sale.price);
      if (!Number.isFinite(price) || price < 25_000) return false;

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
          if (rentEst == null) return false;
        }
        const confidence = near.length >= 8 ? "high" : near.length >= 4 ? "medium" : "low";
        return upsertInvestment(supabase, sale.id, price, rentEst, confidence, near.length);
      }

      const r0 = benchmarkRent(sale, benchmarkMap);
      if (r0) {
        return upsertInvestment(supabase, sale.id, price, r0.rentEst, "low", 0);
      }

      const h = heuristicRent(sale, comps);
      if (!h) return false;
      return upsertInvestment(supabase, sale.id, price, h.rentEst, h.confidence, h.comparablesCount);
    },
    concurrency
  );

  return { candidates: candidates.length, updated: outcomes.filter(Boolean).length };
}