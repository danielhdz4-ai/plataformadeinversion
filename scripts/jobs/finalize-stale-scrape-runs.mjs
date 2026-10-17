/**
 * Marca scrape_runs "running" antiguos como failed (evita UI "kelify running 0 nuevos").
 */
import { getSupabase } from "../scrapers/lib/env.mjs";

const maxAgeHours = Number(process.env.SCRAPE_RUN_MAX_AGE_HOURS ?? "8");
const cutoff = new Date(Date.now() - maxAgeHours * 3600_000).toISOString();

const supabase = getSupabase();
const { data: stale, error } = await supabase
  .from("scrape_runs")
  .select("id, source, city_slug, started_at")
  .eq("status", "running")
  .lt("started_at", cutoff);

if (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exit(1);
}

const ids = (stale ?? []).map((r) => r.id);
if (ids.length === 0) {
  console.log(JSON.stringify({ ok: true, finalized: 0 }));
  process.exit(0);
}

const { error: updErr } = await supabase
  .from("scrape_runs")
  .update({
    status: "failed",
    finished_at: new Date().toISOString(),
    error_message: `stale run (> ${maxAgeHours}h) auto-closed`,
  })
  .in("id", ids);

if (updErr) {
  console.error(JSON.stringify({ ok: false, error: updErr.message }));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, finalized: ids.length, sample: stale?.slice(0, 5) }));
