/**
 * Precompute ROI para ventas dentro del polígono (post zone-ingest).
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geojson = process.env.POLYGON_GEOJSON;
if (!url || !key || !geojson) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: "missing env" }));
  process.exit(0);
}

const supabase = createClient(url, key);
const { data: inPoly, error } = await supabase.rpc("listings_in_polygon", { geojson });
if (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exit(1);
}

const ids = (inPoly ?? []).map((r) => r.id);
if (ids.length === 0) {
  console.log(JSON.stringify({ ok: true, updated: 0, count: 0 }));
  process.exit(0);
}

process.env.ROI_PRECOMPUTE_IDS = ids.join(",");
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const r = spawnSync(process.execPath, ["scripts/jobs/precompute-roi-by-ids.mjs"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
process.exit(r.status ?? 0);
