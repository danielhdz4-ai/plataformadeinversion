import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);
const supabase = createClient(url, key);

const CITY_RE = /madrid|barcelona|valencia|sevilla|m[aá]laga|bilbao/i;

const { data: sales, error } = await supabase
  .from("listings")
  .select("id, city, postal_code, price, bedrooms, geocode_quality")
  .eq("operation", "sale")
  .eq("status", "active")
  .not("geom", "is", null)
  .order("id")
  .limit(5000);
if (error) throw new Error(error.message);

const tier1 = (sales ?? []).filter((s) => CITY_RE.test(s.city ?? ""));
console.log("tier1 sales sample", tier1.length);

const stats = { total: 0, withComp: 0, medium: 0, high: 0, byCity: {} };
for (const s of tier1.slice(0, 120)) {
  const { data: near, error: e } = await supabase.rpc("rent_comparables_near", {
    p_listing_id: s.id,
    max_m: 1200,
    lim: 10,
  });
  if (e) {
    console.log("rpc error", e.message);
    break;
  }
  stats.total++;
  const n = near?.length ?? 0;
  if (n > 0) stats.withComp++;
  if (n >= 4) stats.medium++;
  if (n >= 8) stats.high++;
  const city = (s.city ?? "?").split(" ")[0];
  stats.byCity[city] = stats.byCity[city] ?? { n: 0, comp: 0 };
  stats.byCity[city].n++;
  if (n > 0) stats.byCity[city].comp++;
}
console.log(stats);
