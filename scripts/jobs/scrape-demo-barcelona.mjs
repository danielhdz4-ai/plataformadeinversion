/**
 * Job demo: registra ejecución de scraper y refresca timestamp de cobertura Barcelona.
 * Sustituir por scrape-kelify / scrape-pisos cuando existan parsers reales.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

const { data: run, error: runErr } = await supabase
  .from("scrape_runs")
  .insert({
    source: "demo-barcelona",
    city_slug: "barcelona",
    status: "running",
  })
  .select("id")
  .single();

if (runErr) {
  console.error("scrape_runs insert:", runErr.message);
  process.exit(1);
}

const { count, error: countErr } = await supabase
  .from("listings")
  .select("*", { count: "exact", head: true })
  .in("status", ["demo", "active"]);

if (countErr) {
  await supabase
    .from("scrape_runs")
    .update({ status: "failed", finished_at: new Date().toISOString(), error_message: countErr.message })
    .eq("id", run.id);
  console.error(countErr.message);
  process.exit(1);
}

await supabase
  .from("coverage_regions")
  .update({ last_scrape_at: new Date().toISOString() })
  .eq("slug", "barcelona");

await supabase
  .from("scrape_runs")
  .update({
    status: "completed",
    finished_at: new Date().toISOString(),
    listings_inserted: count ?? 0,
  })
  .eq("id", run.id);

console.log(JSON.stringify({ ok: true, listingsInDb: count ?? 0, runId: run.id }));
