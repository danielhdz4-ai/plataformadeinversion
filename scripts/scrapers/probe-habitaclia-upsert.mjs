import { createClient } from "@supabase/supabase-js";
import { geocodeSpain } from "./lib/geocode-es.mjs";
import { createHabitacliaBrowser, fetchHabitacliaWithBrowser } from "./lib/habitaclia-api.mjs";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

const browser = await createHabitacliaBrowser();
const { listings } = await fetchHabitacliaWithBrowser(
  browser,
  "/comprar/viviendas/madrid-provincia/madrid-capital/s",
  1
);
await browser.close();

const mapped = listings.find((l) => l.price && l.price >= 5000);
console.log("sample", mapped);
const geo = await geocodeSpain("Madrid, España");
console.log("geo", geo);

const payload = {
  source_portal: "habitaclia",
  source_external_id: mapped.externalId,
  operation: "sale",
  title: mapped.title,
  price: mapped.price,
  city: "Madrid",
  ccaa: "Madrid",
  source_url: mapped.sourceUrl,
  status: "active",
  geocode_quality: 4,
  scraped_at: new Date().toISOString(),
};

const { data, error } = await supabase
  .from("listings")
  .upsert(payload, { onConflict: "source_portal,source_external_id" })
  .select("id")
  .maybeSingle();
console.log("upsert", { data, error: error?.message });

if (data?.id && geo) {
  const { error: gErr } = await supabase.rpc("patch_listing_geom", {
    listing_id: data.id,
    lon: geo.lon,
    lat: geo.lat,
  });
  console.log("geom", gErr?.message ?? "ok");
}
