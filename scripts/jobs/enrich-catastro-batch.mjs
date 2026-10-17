/**
 * Enrich listings active con RC vía Catastro OVC (coords → RC). Throttle 1 req/s.
 */
import { createClient } from "@supabase/supabase-js";

const OVC =
  "http://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCoordenadas.svc/json";

async function rcFromCoords(lon, lat) {
  const u = `${OVC}/Consulta_RCCOOR?CoorX=${lon}&CoorY=${lat}&SRS=EPSG:4326`;
  const res = await fetch(u);
  if (!res.ok) return null;
  const data = await res.json();
  const result = data?.Consulta_RCCOORResult ?? data?.consulta_coordenadas;
  let coord = result?.coordenadas?.coord;
  if (!coord) return null;
  if (!Array.isArray(coord)) coord = [coord];
  const pc = coord[0]?.pc ?? coord[0]?.coord?.pc;
  if (!pc?.pc1 || !pc?.pc2) return null;
  return `${pc.pc1}${pc.pc2}`.replace(/\s/g, "");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const limit = Number(process.env.MAX_ENRICH ?? "25");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

const { data: pins } = await supabase.rpc("map_listings_in_bbox", {
  min_lng: 2.05,
  min_lat: 41.32,
  max_lng: 2.25,
  max_lat: 41.48,
  max_rows: 500,
});

const { data: enriched } = await supabase.from("listing_enrichment").select("listing_id, rc");

const hasRc = new Set((enriched ?? []).filter((e) => e.rc).map((e) => e.listing_id));

let done = 0;
for (const pin of pins ?? []) {
  if (done >= limit) continue;
  if (hasRc.has(pin.id)) continue;
  const rc = await rcFromCoords(pin.lng, pin.lat);
  await sleep(1100);
  if (!rc) continue;
  await supabase.from("listing_enrichment").upsert(
    { listing_id: pin.id, rc, raw: { source: "ovc-coordenadas" } },
    { onConflict: "listing_id" }
  );
  await supabase.from("catastro_cache").upsert({
    cache_key: `rc:${rc}`,
    rc,
    payload: { lon: pin.lng, lat: pin.lat },
    fetched_at: new Date().toISOString(),
  });
  done++;
}

console.log(JSON.stringify({ ok: true, enriched: done }));
