import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);
const supabase = createClient(url, key);

const { data: r1, error: e1 } = await supabase
  .from("listings")
  .select("id, price, sqm, bedrooms, postal_code, city")
  .eq("operation", "rent")
  .eq("status", "active")
  .limit(3);
console.log("rent sample", e1?.message ?? r1);

const { count: rentTotal } = await supabase
  .from("listings")
  .select("id", { count: "exact", head: true })
  .eq("operation", "rent")
  .eq("status", "active");
console.log("rent active", rentTotal);

const { data: bm, error: ebm } = await supabase
  .from("rent_benchmarks")
  .select("city_slug, eur_per_sqm_month")
  .limit(5);
console.log("benchmarks", ebm?.message ?? bm);

const { data: cmp, error: e2 } = await supabase.rpc("rent_comparables_near", {
  p_listing_id: "8f992815-7f74-44d8-b79e-5a5b5e48f205",
  max_m: 3000,
  lim: 5,
});
console.log("near 3000m", e2?.message ?? cmp);
