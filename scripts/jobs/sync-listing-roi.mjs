/**
 * 1) Recalcula roi_gross en listing_investment desde precio + rent_est (rápido).
 * 2) Opcional: rellena filas faltantes (ROI_PRECOMPUTE_FILL=1 → delega en precompute-roi).
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);

const { data: rpcCount, error: rpcErr } = await supabase.rpc("sync_listing_investment_roi");
if (!rpcErr && typeof rpcCount === "number") {
  console.log(JSON.stringify({ ok: true, phase: "rpc_sync", updated: rpcCount }));
  if (process.env.ROI_PRECOMPUTE_FILL !== "1") process.exit(0);
}

let offset = 0;
const page = 500;
let synced = 0;

while (true) {
  const { data: rows, error } = await supabase
    .from("listing_investment")
    .select("listing_id, rent_est, roi_gross, listings!inner(price, operation, status)")
    .eq("listings.operation", "sale")
    .eq("listings.status", "active")
    .range(offset, offset + page - 1);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  if (!rows?.length) break;

  for (const row of rows) {
    const price = Number(row.listings?.price);
    const rent = Number(row.rent_est);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(rent) || rent <= 0) continue;
    const roi = Math.round(((rent * 12) / price) * 100 * 1000) / 1000;
    if (Math.abs(Number(row.roi_gross) - roi) < 0.01) continue;
    const { error: upErr } = await supabase
      .from("listing_investment")
      .update({ roi_gross: roi, computed_at: new Date().toISOString() })
      .eq("listing_id", row.listing_id);
    if (!upErr) synced++;
  }

  offset += rows.length;
  if (rows.length < page) break;
}

console.log(JSON.stringify({ ok: true, phase: "js_sync", updated: synced }));

if (process.env.ROI_PRECOMPUTE_FILL === "1") {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, ["scripts/jobs/precompute-roi.mjs"], {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
  });
  process.exit(r.status ?? 1);
}
