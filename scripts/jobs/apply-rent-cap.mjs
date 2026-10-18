import { createClient } from "@supabase/supabase-js";
import { capRentEstForSalePrice } from "../scrapers/lib/rent-cap.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);
let offset = 0;
let updated = 0;
let removed = 0;

while (true) {
  const { data: rows, error } = await supabase
    .from("listing_investment")
    .select("listing_id, rent_est, roi_gross, listings!inner(price, operation, status)")
    .eq("listings.operation", "sale")
    .eq("listings.status", "active")
    .range(offset, offset + 499);

  if (error) throw error;
  if (!rows?.length) break;

  for (const row of rows) {
    const price = Number(row.listings?.price);
    const capped = capRentEstForSalePrice(row.rent_est, price);
    if (capped == null || price < 25_000) {
      await supabase.from("listing_investment").delete().eq("listing_id", row.listing_id);
      removed++;
      continue;
    }
    const roi = Math.round(((capped * 12) / price) * 100 * 1000) / 1000;
    if (capped === row.rent_est && Math.abs(roi - Number(row.roi_gross)) < 0.05) continue;
    await supabase
      .from("listing_investment")
      .update({
        rent_est: capped,
        roi_gross: roi,
        computed_at: new Date().toISOString(),
      })
      .eq("listing_id", row.listing_id);
    updated++;
  }

  offset += rows.length;
  if (rows.length < 500) break;
}

console.log(JSON.stringify({ ok: true, updated, removed }));
