/** Recalcula inversión donde rent_est era precio de venta mal usado como alquiler. */
import { createClient } from "@supabase/supabase-js";
import { isPlausibleMonthlyRent } from "../scrapers/lib/rent-plausible.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);

const { data: bad, error } = await supabase
  .from("listing_investment")
  .select("listing_id, rent_est, roi_gross")
  .or("rent_est.gt.15000,roi_gross.gt.100");

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(JSON.stringify({ toFix: bad?.length ?? 0 }));

const { spawnSync } = await import("node:child_process");
const ids = (bad ?? []).map((r) => r.listing_id);
for (const id of ids) {
  await supabase.from("listing_investment").delete().eq("listing_id", id);
}

const r = spawnSync(
  process.execPath,
  ["scripts/jobs/precompute-roi.mjs"],
  { stdio: "inherit", env: { ...process.env, ROI_PRECOMPUTE_BATCH: "5000" }, cwd: process.cwd() }
);

const { count } = await supabase
  .from("listing_investment")
  .select("listing_id", { count: "exact", head: true })
  .or("rent_est.gt.15000,roi_gross.gt.100");
console.log(JSON.stringify({ exit: r.status, remainingAbsurd: count }));
process.exit(r.status ?? 0);
