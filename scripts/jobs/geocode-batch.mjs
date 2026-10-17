/**
 * B2 — Geocode batch: listings activos sin geom o quality>=5, max 200/run, 1 req/s Nominatim.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const supabase = createClient(url, key);
const MAX = Number(process.env.GEOCODE_BATCH_MAX ?? "200");
const UA = "plataformadeinversion-geocode-batch/1.0";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function nominatim(query) {
  const cacheKey = query.toLowerCase().trim();
  const { data: cached } = await supabase
    .from("geocode_cache")
    .select("lon, lat")
    .eq("query_key", cacheKey)
    .maybeSingle();
  if (cached) return cached;

  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("q", query);
  u.searchParams.set("format", "json");
  u.searchParams.set("limit", "1");
  u.searchParams.set("countrycodes", "es");
  await sleep(1100);
  const res = await fetch(u.toString(), { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const data = await res.json();
  const hit = data?.[0];
  if (!hit) return null;
  const lon = Number(hit.lon);
  const lat = Number(hit.lat);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  await supabase.from("geocode_cache").upsert({
    query_key: cacheKey,
    lon,
    lat,
    source: "nominatim",
  });
  return { lon, lat };
}

const { data: rows } = await supabase
  .from("listings")
  .select("id, title, city, ccaa, geocode_quality")
  .eq("status", "active")
  .or("geom.is.null,geocode_quality.gte.5")
  .limit(MAX);

let ok = 0;
let fail = 0;
for (const row of rows ?? []) {
  const q = `${row.title ?? "inmueble"}, ${row.city ?? ""}, ${row.ccaa ?? "España"}, España`;
  const geo = await nominatim(q.replace(/\s+/g, " ").trim());
  if (!geo) {
    fail++;
    await supabase.from("geocode_pending").upsert({
      listing_id: row.id,
      reason: "nominatim_miss",
      attempts: 1,
      updated_at: new Date().toISOString(),
    });
    continue;
  }
  const { error } = await supabase.rpc("patch_listing_geom", {
    listing_id: row.id,
    lon: geo.lon,
    lat: geo.lat,
  });
  if (error) {
    fail++;
    continue;
  }
  await supabase.from("listings").update({ geocode_quality: 3 }).eq("id", row.id);
  await supabase.from("geocode_pending").delete().eq("listing_id", row.id);
  ok++;
}

console.log(JSON.stringify({ ok: true, processed: (rows ?? []).length, geocoded: ok, failed: fail }));
