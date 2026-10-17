/**
 * Actualiza sale_count / rent_count y last_scrape_at en coverage_regions por city slug.
 */
import { createClient } from "@supabase/supabase-js";
import { listCities } from "../scrapers/lib/spain-city.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const supabase = createClient(url, key);
const cities = listCities();

let updated = 0;
for (const city of cities) {
  const slug = city.slug;
  const name = city.name;
  const cityFilter = city.regionPattern ?? name.split(" ")[0] ?? name;
  const { count: saleCount } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("operation", "sale")
    .eq("status", "active")
    .ilike("city", `%${cityFilter}%`);

  const { count: rentCount } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("operation", "rent")
    .eq("status", "active")
    .ilike("city", `%${cityFilter}%`);

  const { data: latest } = await supabase
    .from("listings")
    .select("scraped_at")
    .eq("status", "active")
    .ilike("city", `%${cityFilter}%`)
    .order("scraped_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    slug,
    name,
    tier: city.tier ?? 2,
    bbox: city.bbox ?? null,
    sale_count: saleCount ?? 0,
    rent_count: rentCount ?? 0,
    last_scrape_at: latest?.scraped_at ?? null,
  };
  let { error } = await supabase.from("coverage_regions").upsert(payload, { onConflict: "slug" });
  if (error && /sale_count|rent_count|schema cache/i.test(error.message)) {
    const slim = {
      slug,
      name,
      tier: city.tier ?? 2,
      bbox: city.bbox ?? null,
      last_scrape_at: latest?.scraped_at ?? null,
    };
    ({ error } = await supabase.from("coverage_regions").upsert(slim, { onConflict: "slug" }));
  }
  if (error) console.error(slug, error.message);
  else updated++;
}

console.log(JSON.stringify({ ok: true, regions: updated }));
