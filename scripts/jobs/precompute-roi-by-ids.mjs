/**
 * Precompute listing_investment para IDs listados en ROI_PRECOMPUTE_IDS (comma-separated).
 */
import { createClient } from "@supabase/supabase-js";
import { capRentEstForSalePrice } from "../scrapers/lib/rent-cap.mjs";
import { isPlausibleMonthlyRent } from "../scrapers/lib/rent-plausible.mjs";
import { listCities } from "../scrapers/lib/spain-city.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const rawIds = process.env.ROI_PRECOMPUTE_IDS ?? "";
const ids = rawIds.split(",").map((s) => s.trim()).filter(Boolean);
if (!url || !key || ids.length === 0) {
  console.log(JSON.stringify({ ok: true, updated: 0 }));
  process.exit(0);
}

const supabase = createClient(url, key);
const cityCatalog = listCities();

async function loadRentBenchmarks() {
  const { data } = await supabase.from("rent_benchmarks").select("city_slug, eur_per_sqm_month");
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

const benchmarkMap = await loadRentBenchmarks();
let updated = 0;

for (const saleId of ids) {
  const { data: sale } = await supabase
    .from("listings")
    .select("id, price, sqm, city")
    .eq("id", saleId)
    .eq("operation", "sale")
    .maybeSingle();
  if (!sale) continue;
  const price = Number(sale.price);
  if (!Number.isFinite(price) || price < 25_000) continue;

  const { data: near } = await supabase.rpc("rent_comparables_near", {
    p_listing_id: saleId,
    max_m: 800,
    lim: 12,
  });

  let rentEst = null;
  let confidence = "low";
  let comparablesCount = 0;

  if (near?.length) {
    const rents = near.map((c) => Number(c.price)).filter(isPlausibleMonthlyRent).sort((a, b) => a - b);
    const median = rents[Math.floor(rents.length / 2)];
    rentEst = capRentEstForSalePrice(Math.round(median * 0.92), price);
    confidence = near.length >= 8 ? "high" : near.length >= 4 ? "medium" : "low";
    comparablesCount = near.length;
  } else {
    const slug = citySlugFromListing(sale.city);
    const eurSqm = slug ? benchmarkMap.get(slug) : null;
    const sqm = Number(sale.sqm);
    if (eurSqm && sqm >= 12) {
      rentEst = capRentEstForSalePrice(Math.round(sqm * eurSqm * 0.85), price);
      comparablesCount = 0;
    }
  }

  if (rentEst == null) continue;
  const roi = (rentEst * 12) / price;
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
  if (!upErr) updated++;
}

console.log(JSON.stringify({ ok: true, updated, ids: ids.length }));
