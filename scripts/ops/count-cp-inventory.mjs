/**
 * Inventario venta activa por CP (exacto + por radio vía RPC).
 * node --env-file=.env.local scripts/ops/count-cp-inventory.mjs 28033
 */
import { createClient } from "@supabase/supabase-js";
import { geocodePostalCodeSpain } from "../scrapers/lib/geocode-es.mjs";

const cp = process.argv[2]?.trim();
if (!cp || !/^\d{5}$/.test(cp)) {
  console.error("Uso: node scripts/ops/count-cp-inventory.mjs <cp>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const sb = createClient(url, key);

const { count: exactTotal, error } = await sb
  .from("listings")
  .select("*", { count: "exact", head: true })
  .eq("status", "active")
  .eq("operation", "sale")
  .eq("postal_code", cp);
if (error) {
  console.error(error.message);
  process.exit(1);
}

const { data: exactRows } = await sb
  .from("listings")
  .select("source_portal")
  .eq("status", "active")
  .eq("operation", "sale")
  .eq("postal_code", cp);

const byPortalExact = {};
for (const r of exactRows ?? []) {
  const p = r.source_portal ?? "unknown";
  byPortalExact[p] = (byPortalExact[p] ?? 0) + 1;
}

const out = {
  postalCode: cp,
  exactPostalCodeTotal: exactTotal ?? 0,
  byPortalExact: Object.entries(byPortalExact)
    .sort((a, b) => b[1] - a[1])
    .map(([portal, n]) => ({ portal, n })),
};

const geo = await geocodePostalCodeSpain(cp);
if (geo) {
  const { data: mapRows, error: rpcErr } = await sb.rpc("listings_for_postal_code", {
    p_cp: cp,
    p_lng: geo.lon,
    p_lat: geo.lat,
    p_radius_m: Number(process.env.SCRAPE_CP_TAG_RADIUS_M ?? "2800"),
    max_rows: 2000,
    portal_filter: null,
  });
  if (!rpcErr && Array.isArray(mapRows)) {
    const byPortalMap = {};
    for (const r of mapRows) {
      const p = r.source_portal ?? "unknown";
      byPortalMap[p] = (byPortalMap[p] ?? 0) + 1;
    }
    out.mapRadiusTotal = mapRows.length;
    out.byPortalMapRadius = Object.entries(byPortalMap)
      .sort((a, b) => b[1] - a[1])
      .map(([portal, n]) => ({ portal, n }));
  } else if (rpcErr) {
    out.rpcHint = "Ejecuta supabase/scripts/listings-by-cp-full.sql";
  }
}

console.log(JSON.stringify(out, null, 2));
