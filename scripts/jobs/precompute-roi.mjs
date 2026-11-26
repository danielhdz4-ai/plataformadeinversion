/**
 * Precompute listing_investment usando rent_comparables_near (PostGIS) + fallback heurístico.
 */
import { createClient } from "@supabase/supabase-js";
import { capRentEstForSalePrice } from "../scrapers/lib/rent-cap.mjs";
import { isPlausibleMonthlyRent } from "../scrapers/lib/rent-plausible.mjs";
import { listCities } from "../scrapers/lib/spain-city.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);
const cityCatalog = listCities();

const CONCURRENCY = Math.min(12, Math.max(1, Number(process.env.ROI_CONCURRENCY ?? "6")));
const maxSalesEnv = process.env.ROI_PRECOMPUTE_BATCH;
const maxSales =
  maxSalesEnv != null && maxSalesEnv !== "" ? Number(maxSalesEnv) : Number.POSITIVE_INFINITY;

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
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      if (isPlausibleMonthlyRent(row.price)) all.push(row);
    }
    offset += data.length;
    if (data.length < page) break;
  }
  return all;
}

async function loadRentBenchmarks() {
  const { data, error } = await supabase.from("rent_benchmarks").select("city_slug, eur_per_sqm_month");
  if (error) {
    console.warn("rent_benchmarks", error.message);
    return new Map();
  }
  return new Map((data ?? []).map((r) => [r.city_slug, Number(r.eur_per_sqm_month)]));
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

function benchmarkRent(sale, benchmarkMap) {
  const slug = citySlugFromListing(sale.city);
  if (!slug) return null;
  const eurSqm = benchmarkMap.get(slug);
  const sqm = Number(sale.sqm);
  if (!eurSqm || !Number.isFinite(sqm) || sqm < 12) return null;
  let rentEst = capRentEstForSalePrice(Math.round(sqm * eurSqm * 0.85), Number(sale.price));
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
  return {
    rentEst,
    confidence: n >= 5 ? "medium" : n >= 2 ? "low" : "low",
    comparablesCount: Math.min(n, 12),
  };
}

async function upsertInvestment(saleId, price, rentEst, confidence, comparablesCount) {
  const capped = capRentEstForSalePrice(rentEst, price);
  if (capped == null) return false;
  rentEst = capped;
  const roi = (rentEst * 12) / Number(price);
  const { error: upErr } = await supabase.from("listing_investment").upsert(
    {
      listing_id: saleId,
      rent_est: rentEst,
      rent_confidence: confidence,
      comparables_count: comparablesCount,
      roi_gross: Math.round(roi * 100 * 1000) / 1000,
      computed_at: new Date().toISOString(),
    },
    { onConflict: "listing_id" }
  );
  return !upErr;
}

async function computeOne(sale, globalRents, benchmarkMap) {
  const price = Number(sale.price);
  if (!Number.isFinite(price) || price < 25_000) return { ok: false };

  const { data: near, error: nearErr } = await supabase.rpc("rent_comparables_near", {
    p_listing_id: sale.id,
    max_m: 800,
    lim: 12,
  });

  if (!nearErr && near && near.length > 0) {
    const rentsEur = near.map((c) => Number(c.price)).filter(isPlausibleMonthlyRent);
    const sorted = rentsEur.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? sorted[0];
    let rentEst = Math.round(median * 0.92);
    if (near.length >= 4) {
      if (!isPlausibleMonthlyRent(rentEst)) return { ok: false };
    } else {
      rentEst = capRentEstForSalePrice(rentEst, price);
      if (rentEst == null) return { ok: false };
    }
    const confidence = near.length >= 8 ? "high" : near.length >= 4 ? "medium" : "low";
    const ok = await upsertInvestment(sale.id, price, rentEst, confidence, near.length);
    return { ok, spatial: true };
  }

  const r0 = benchmarkRent(sale, benchmarkMap);
  if (r0) {
    const ok = await upsertInvestment(
      sale.id,
      price,
      r0.rentEst,
      r0.confidence,
      r0.comparablesCount
    );
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

const globalRents = await loadAllRentComps();
const benchmarkMap = await loadRentBenchmarks();
let updated = 0;
let spatial = 0;
let r0Count = 0;
let salesTotal = 0;
let offset = 0;
const page = 200;

while (salesTotal < maxSales) {
  const pageSize = Math.min(page, maxSales - salesTotal);
  const { data: sales, error } = await supabase
    .from("listings")
    .select("id, price, sqm, bedrooms, city")
    .eq("operation", "sale")
    .eq("status", "active")
    .order("id")
    .range(offset, offset + pageSize - 1);

  if (error) throw error;
  if (!sales?.length) break;
  salesTotal += sales.length;

  const outcomes = await mapPool(
    sales,
    (s) => computeOne(s, globalRents, benchmarkMap),
    CONCURRENCY
  );
  for (const o of outcomes) {
    if (o?.ok) {
      updated++;
      if (o.spatial) spatial++;
      if (o.r0) r0Count++;
    }
  }

  offset += sales.length;
  if (sales.length < pageSize) break;
}

console.log(
  JSON.stringify({
    ok: true,
    sales: salesTotal,
    updated,
    spatial,
    rentCompsLoaded: globalRents.length,
    rentBenchmarkCities: benchmarkMap.size,
    r0Estimates: r0Count,
    concurrency: CONCURRENCY,
  })
);
