/**
 * Actualiza rent_benchmarks (R0) — mediana €/m²/mes por ciudad Tier desde alquileres activos.
 */
import { createClient } from "@supabase/supabase-js";
import { isPlausibleMonthlyRent } from "../scrapers/lib/rent-plausible.mjs";
import { listCities } from "../scrapers/lib/spain-city.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const MIN_SAMPLES = Number(process.env.RENT_BENCHMARK_MIN_SAMPLES ?? "15");
const supabase = createClient(url, key);

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

async function eurSqmSamples(cityFilter) {
  const rates = [];
  let offset = 0;
  const page = 500;
  while (true) {
    const { data, error } = await supabase
      .from("listings")
      .select("price, sqm")
      .eq("operation", "rent")
      .eq("status", "active")
      .ilike("city", `%${cityFilter}%`)
      .not("sqm", "is", null)
      .gt("sqm", 15)
      .range(offset, offset + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const price = Number(row.price);
      const sqm = Number(row.sqm);
      if (!isPlausibleMonthlyRent(price) || !Number.isFinite(sqm) || sqm < 15) continue;
      rates.push(price / sqm);
    }
    offset += data.length;
    if (data.length < page) break;
  }
  return rates;
}

let upserted = 0;
for (const city of listCities()) {
  const cityFilter = city.regionPattern ?? city.name.split(" ")[0] ?? city.name;
  const rates = await eurSqmSamples(cityFilter);
  if (rates.length < MIN_SAMPLES) continue;
  const med = median(rates);
  if (med == null || med <= 0) continue;
  const eur = Math.round(med * 1000) / 1000;
  const { error } = await supabase.from("rent_benchmarks").upsert(
    {
      city_slug: city.slug,
      eur_per_sqm_month: eur,
      sample_count: rates.length,
      computed_at: new Date().toISOString(),
    },
    { onConflict: "city_slug" }
  );
  if (error) {
    console.error(city.slug, error.message);
    continue;
  }
  upserted++;
}

console.log(JSON.stringify({ ok: true, citiesWithBenchmark: upserted, minSamples: MIN_SAMPLES }));
