/**
 * Precompute listing_investment usando rent_comparables_near (PostGIS) + fallback heurístico.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);

const { data: rents } = await supabase
  .from("listings")
  .select("price, sqm, bedrooms")
  .eq("operation", "rent")
  .eq("status", "active");

function heuristicRent(sale, compsGlobal) {
  const sqm = Number(sale.sqm) || 60;
  const beds = sale.bedrooms ?? 2;
  const comps = compsGlobal.filter(
    (r) => Math.abs((r.bedrooms ?? 2) - beds) <= 1 && Math.abs(Number(r.sqm || 60) - sqm) <= 20
  );
  const rentsEur = comps.map((c) => Number(c.price)).filter((n) => n > 0);
  let rentEst = rentsEur.length
    ? rentsEur.sort((a, b) => a - b)[Math.floor(rentsEur.length / 2)] * 0.85
    : sqm * 14;
  return {
    rentEst: Math.round(rentEst),
    confidence: comps.length >= 5 ? "medium" : comps.length >= 2 ? "low" : "low",
    comparablesCount: comps.length,
  };
}

async function upsertInvestment(saleId, price, rentEst, confidence, comparablesCount) {
  const roi = (rentEst * 12) / Number(price);
  const { error: upErr } = await supabase.from("listing_investment").upsert(
    {
      listing_id: saleId,
      rent_est: rentEst,
      rent_confidence: confidence,
      comparables_count: comparablesCount,
      roi_gross: roi * 100,
      computed_at: new Date().toISOString(),
    },
    { onConflict: "listing_id" }
  );
  return !upErr;
}

const batchSize = Number(process.env.ROI_PRECOMPUTE_BATCH ?? "4500");
let updated = 0;
let spatial = 0;
const globalRents = rents ?? [];
let offset = 0;
let salesTotal = 0;

while (offset < batchSize) {
  const pageSize = Math.min(1000, batchSize - offset);
  const { data: sales, error } = await supabase
    .from("listings")
    .select("id, price, sqm, bedrooms")
    .eq("operation", "sale")
    .eq("status", "active")
    .range(offset, offset + pageSize - 1);

  if (error) throw error;
  if (!sales?.length) break;
  salesTotal += sales.length;

  for (const sale of sales) {
  const price = Number(sale.price);
  if (!Number.isFinite(price) || price <= 0) continue;

  const { data: near, error: nearErr } = await supabase.rpc("rent_comparables_near", {
    p_listing_id: sale.id,
    max_m: 800,
    lim: 12,
  });

  if (!nearErr && near && near.length > 0) {
    const rentsEur = near.map((c) => Number(c.price)).filter((n) => n > 0);
    const sorted = rentsEur.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? sorted[0];
    const rentEst = Math.round(median * 0.92);
    const confidence = near.length >= 8 ? "high" : near.length >= 4 ? "medium" : "low";
    if (await upsertInvestment(sale.id, price, rentEst, confidence, near.length)) {
      updated++;
      spatial++;
    }
    continue;
  }

  const h = heuristicRent(sale, globalRents);
  if (await upsertInvestment(sale.id, price, h.rentEst, h.confidence, h.comparablesCount)) {
    updated++;
  }
  }

  offset += sales.length;
  if (sales.length < pageSize) break;
}

console.log(JSON.stringify({ ok: true, sales: salesTotal, updated, spatial }));
