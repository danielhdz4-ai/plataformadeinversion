import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);
const s = createClient(url, key);
const { data } = await s
  .from("scrape_runs")
  .select("source, status, listings_inserted, started_at, finished_at, error_message")
  .in("source", ["hipoges", "solvia"])
  .order("started_at", { ascending: false })
  .limit(6);
console.log(JSON.stringify(data, null, 2));
