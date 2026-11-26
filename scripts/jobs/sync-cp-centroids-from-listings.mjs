/**
 * Centroides aproximados desde listings activos con geom por CP.
 * Uso: node --env-file=.env.local scripts/jobs/sync-cp-centroids-from-listings.mjs
 */
import { getSupabase } from "../scrapers/lib/env.mjs";

const supabase = getSupabase();
const pageSize = 500;
let from = 0;
const byCp = new Map();

while (true) {
  const { data, error } = await supabase
    .from("listings")
    .select("postal_code, geom")
    .eq("status", "active")
    .not("geom", "is", null)
    .not("postal_code", "is", null)
    .range(from, from + pageSize - 1);

  if (error) throw error;
  if (!data?.length) break;

  for (const row of data) {
    const cp = String(row.postal_code).replace(/\D/g, "").slice(0, 5);
    if (cp.length !== 5) continue;
    const g = row.geom;
    let lng;
    let lat;
    if (g?.coordinates?.length >= 2) {
      [lng, lat] = g.coordinates;
    } else if (g?.type === "Point" && Array.isArray(g.coordinates)) {
      [lng, lat] = g.coordinates;
    } else continue;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const agg = byCp.get(cp) ?? { lng: 0, lat: 0, n: 0 };
    agg.lng += lng;
    agg.lat += lat;
    agg.n++;
    byCp.set(cp, agg);
  }
  from += pageSize;
  if (data.length < pageSize) break;
}

let upserted = 0;
for (const [postal_code, agg] of byCp) {
  if (agg.n < 3) continue;
  const lat = agg.lat / agg.n;
  const lng = agg.lng / agg.n;
  const { error } = await supabase.from("cp_centroids").upsert({
    postal_code,
    lat,
    lng,
    label: `CP ${postal_code}, España`,
    source: "listings_geom_avg",
    updated_at: new Date().toISOString(),
  });
  if (!error) upserted++;
}

console.log(JSON.stringify({ ok: true, cps: byCp.size, upserted }, null, 2));