/**
 * Prueba lógica post-scrape (freshIds + RPC) sin depender de geocoder externo.
 * Uso: node --env-file=.env.local scripts/ops/test-cp-api-route.mjs 41001
 */
import { geocodePostalCodeSpain } from "./../scrapers/lib/geocode-es.mjs";
import { getSupabase } from "./../scrapers/lib/env.mjs";

const cp = process.argv[2] ?? "41001";
const supabase = getSupabase();

const FALLBACK = {
  "41001": { lat: 37.3891, lon: -5.9845 },
  "28033": { lat: 40.4598, lon: -3.6765 },
};
const geo = (await geocodePostalCodeSpain(cp)) ?? FALLBACK[cp] ?? null;
if (!geo) {
  console.log(JSON.stringify({ ok: false, cp, error: "geocode_failed" }));
  process.exit(1);
}

const { data: rows } = await supabase
  .from("listings")
  .select("id, property_kind, source_portal")
  .eq("status", "active")
  .eq("operation", "sale")
  .eq("postal_code", cp)
  .not("geom", "is", null)
  .limit(500);

const freshIds = new Set((rows ?? []).map((r) => r.id));
const byPortal = {};
for (const r of rows ?? []) {
  const p = r.source_portal ?? "unknown";
  byPortal[p] = (byPortal[p] ?? 0) + 1;
}

const portals = ["fotocasa", "pisos_com", "hipoges", "solvia"];
let merged = 0;
for (const portal of portals) {
  const { data, error } = await supabase.rpc("listings_for_postal_code", {
    p_cp: cp,
    p_lng: geo.lon,
    p_lat: geo.lat,
    p_radius_m: 2800,
    max_rows: 120,
    portal_filter: portal,
  });
  if (error) {
    console.log(JSON.stringify({ ok: false, cp, rpcError: error.message }));
    process.exit(1);
  }
  for (const row of data ?? []) {
    if (freshIds.has(row.id)) merged++;
  }
}

const ok = freshIds.size >= 20 && merged >= 15;
console.log(
  JSON.stringify(
    {
      ok,
      cp,
      center: geo,
      freshIds: freshIds.size,
      byPortal,
      mergedForApi: merged,
    },
    null,
    2
  )
);
process.exit(ok ? 0 : 1);
