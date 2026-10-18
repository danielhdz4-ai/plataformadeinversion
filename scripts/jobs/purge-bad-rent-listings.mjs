/** Archiva alquileres con precio mensual imposible (venta mal parseada). */
import { createClient } from "@supabase/supabase-js";
import { RENT_MAX_EUR, RENT_MIN_EUR } from "../scrapers/lib/rent-plausible.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);

const { data: bad, error } = await supabase
  .from("listings")
  .select("id, title, price, source_url")
  .eq("operation", "rent")
  .eq("status", "active")
  .or(`price.lt.${RENT_MIN_EUR},price.gt.${RENT_MAX_EUR}`);

if (error) {
  console.error(error.message);
  process.exit(1);
}

let archived = 0;
for (const row of bad ?? []) {
  const { error: upErr } = await supabase
    .from("listings")
    .update({ status: "archived", scraped_at: new Date().toISOString() })
    .eq("id", row.id);
  if (!upErr) archived++;
}

console.log(JSON.stringify({ ok: true, found: bad?.length ?? 0, archived, sample: bad?.slice(0, 5) }));
