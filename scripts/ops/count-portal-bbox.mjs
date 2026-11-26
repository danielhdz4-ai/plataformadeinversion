/** node scripts/ops/count-portal-bbox.mjs minLng minLat maxLng maxLat */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = [join(root, ".env.local"), join(root, "apps/web/.env.local")].find((p) => {
  try {
    readFileSync(p, "utf8");
    return true;
  } catch {
    return false;
  }
});
let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.+)$/);
    if (!m) continue;
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    if (m[1].startsWith("NEXT_PUBLIC")) url = v;
    else key = v;
  }
}

const [minLng, minLat, maxLng, maxLat] = process.argv.slice(2).map(Number);
const sb = createClient(url, key);

const portals = [
  "fotocasa",
  "pisos_com",
  "kelify",
  "habitaclia",
  "hipoges",
  "solvia",
  "idealista",
];

const totals = {};
for (const portal of portals) {
  const { data, error } = await sb.rpc("map_listings_in_bbox", {
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
    max_rows: 500,
    portal_filter: portal,
  });
  if (error) {
    console.log(portal, "ERR", error.message);
    continue;
  }
  totals[portal] = data?.length ?? 0;
}

const { data: all, error: e2 } = await sb.rpc("map_listings_in_bbox", {
  min_lng: minLng,
  min_lat: minLat,
  max_lng: maxLng,
  max_lat: maxLat,
  max_rows: 800,
});
console.log(JSON.stringify({ bbox: [minLng, minLat, maxLng, maxLat], byPortal: totals, merged: all?.length ?? 0, rpcError: e2?.message }, null, 2));
