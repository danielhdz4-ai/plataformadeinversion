import { createClient } from "@supabase/supabase-js";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await s
  .from("listings")
  .select("id, listing_investment(listing_id)")
  .eq("operation", "sale")
  .eq("status", "active")
  .lt("price", 25000);
let n = 0;
for (const row of data ?? []) {
  if (!row.listing_investment) continue;
  await s.from("listing_investment").delete().eq("listing_id", row.id);
  n++;
}
console.log(JSON.stringify({ ok: true, removed: n }));
