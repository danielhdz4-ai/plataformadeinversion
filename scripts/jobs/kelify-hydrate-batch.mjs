/**
 * Hidrata fichas Kelify (m², dormitorios, CP) desde HTML de detalle.
 */
import { createClient } from "@supabase/supabase-js";
import { fetchKelifyDetail } from "../scrapers/lib/kelify-parse-detail.mjs";
import { geocodeSpain } from "../scrapers/lib/geocode-es.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);
const MAX = Number(process.env.KELIFY_HYDRATE_MAX ?? "150");
const PAUSE = Number(process.env.KELIFY_HYDRATE_PAUSE_MS ?? "400");

const { data: rows, error } = await supabase
  .from("listings")
  .select("id, source_url, title, city, ccaa, price")
  .eq("source_portal", "kelify")
  .eq("operation", "sale")
  .eq("status", "active")
  .eq("kelify_hydrated", false)
  .order("scraped_at", { ascending: false })
  .limit(MAX);

if (error) {
  console.error(error.message);
  process.exit(1);
}

let ok = 0;
let fail = 0;
for (const row of rows ?? []) {
  const detail = await fetchKelifyDetail(row.source_url);
  if (!detail) {
    fail++;
    await sleep(PAUSE);
    continue;
  }
  const patch = {
    title: (detail.title ?? row.title)?.slice(0, 200),
    price: detail.price ?? row.price,
    sqm: detail.sqm,
    bedrooms: detail.bedrooms,
    bathrooms: detail.bathrooms,
    postal_code: detail.postalCode,
    city: detail.city ?? row.city,
    kelify_hydrated: true,
    scraped_at: new Date().toISOString(),
  };
  if (detail.thumbnailUrl) patch.thumbnail_url = detail.thumbnailUrl;

  const { error: upErr } = await supabase.from("listings").update(patch).eq("id", row.id);
  if (upErr) {
    fail++;
    continue;
  }

  if (detail.postalCode || detail.title) {
    const geo = await geocodeSpain(
      `${detail.title ?? row.title}, ${detail.postalCode ?? ""} ${detail.city ?? row.city}, España`
    );
    if (geo) {
      await supabase.rpc("patch_listing_geom", { listing_id: row.id, lon: geo.lon, lat: geo.lat });
      await supabase.from("listings").update({ geocode_quality: 2 }).eq("id", row.id);
    }
  }
  ok++;
  await sleep(PAUSE);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

console.log(JSON.stringify({ ok: true, hydrated: ok, failed: fail, batch: rows?.length ?? 0 }));
