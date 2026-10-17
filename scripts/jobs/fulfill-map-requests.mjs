/**
 * Procesa user_map_requests pendientes → scrape batch por ciudad más cercana.
 */
import { createClient } from "@supabase/supabase-js";
import { runKelifySale } from "../scrapers/lib/run-kelify-scrape.mjs";
import { runPisosRent, runPisosSale } from "../scrapers/lib/run-pisos-scrape.mjs";
import { getCityConfig, listCities } from "../scrapers/lib/spain-city.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);
const cities = listCities();

function centerOfBbox(minLng, minLat, maxLng, maxLat) {
  return { lng: (minLng + maxLng) / 2, lat: (minLat + maxLat) / 2 };
}

function nearestCity(lng, lat) {
  let best = cities[0];
  let bestD = Infinity;
  for (const c of cities) {
    const [clng, clat] = c.bbox
      ? [(c.bbox[0] + c.bbox[2]) / 2, (c.bbox[1] + c.bbox[3]) / 2]
      : [0, 40];
    const d = (clng - lng) ** 2 + (clat - lat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

const { data: pending } = await supabase
  .from("user_map_requests")
  .select("id, min_lng, min_lat, max_lng, max_lat")
  .is("fulfilled_at", null)
  .order("created_at", { ascending: true })
  .limit(5);

const results = [];
for (const req of pending ?? []) {
  const { lng, lat } = centerOfBbox(req.min_lng, req.min_lat, req.max_lng, req.max_lat);
  const city = nearestCity(lng, lat);
  try {
    const cfg = getCityConfig(city.slug);
    process.env.MAX_LISTINGS = process.env.MAX_LISTINGS ?? "80";
    await runPisosSale(cfg.slug);
    await runPisosRent(cfg.slug);
    await runKelifySale(cfg.slug);
    await supabase
      .from("user_map_requests")
      .update({ fulfilled_at: new Date().toISOString() })
      .eq("id", req.id);
    results.push({ id: req.id, city: cfg.slug, ok: true });
  } catch (e) {
    results.push({
      id: req.id,
      city: city.slug,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

console.log(JSON.stringify({ ok: true, processed: results.length, results }));
