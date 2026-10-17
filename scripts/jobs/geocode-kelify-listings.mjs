/**
 * Corrige coordenadas kelify (antes en cuadrícula falsa).
 */
import { createClient } from "@supabase/supabase-js";
import { geocodeSpain } from "../scrapers/lib/geocode-es.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);
const { data: rows } = await supabase
  .from("listings")
  .select("id, title, city")
  .eq("source_portal", "kelify")
  .eq("operation", "sale")
  .eq("status", "active")
  .limit(80);

let updated = 0;
for (const row of rows ?? []) {
  const q = `${row.title ?? "piso"}, ${row.city ?? "Barcelona"}, España`;
  const geo = await geocodeSpain(q);
  if (!geo) continue;
  const { error } = await supabase.rpc("patch_listing_geom", {
    listing_id: row.id,
    lon: geo.lon,
    lat: geo.lat,
  });
  if (!error) updated++;
}

console.log(JSON.stringify({ ok: true, processed: rows?.length ?? 0, updated }));
