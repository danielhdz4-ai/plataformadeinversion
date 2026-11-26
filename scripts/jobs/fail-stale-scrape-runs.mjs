/**
 * Marca como failed las corridas scrape_runs atascadas (running > 2h).
 *   node scripts/jobs/fail-stale-scrape-runs.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const env = {};
for (const rel of [".env.local", "apps/web/.env.local"]) {
  try {
    for (const line of readFileSync(join(root, rel), "utf8").split(/\r?\n/)) {
      const m = line.match(/^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$/);
      if (!m) continue;
      env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* skip */
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(JSON.stringify({ ok: false, error: "missing_supabase_env" }));
  process.exit(1);
}

const supabase = createClient(url, key);
const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

const { data: stale, error: selErr } = await supabase
  .from("scrape_runs")
  .select("id, source, started_at")
  .eq("status", "running")
  .lt("started_at", cutoff);

if (selErr) {
  console.error(JSON.stringify({ ok: false, error: selErr.message }));
  process.exit(1);
}

const ids = (stale ?? []).map((r) => r.id);
if (!ids.length) {
  console.log(JSON.stringify({ ok: true, failed: 0, message: "no_stale_runs" }));
  process.exit(0);
}

const { error: updErr } = await supabase
  .from("scrape_runs")
  .update({
    status: "failed",
    finished_at: new Date().toISOString(),
    error_message: "stale_run_auto_failed",
  })
  .in("id", ids);

if (updErr) {
  console.error(JSON.stringify({ ok: false, error: updErr.message }));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, failed: ids.length, cutoff, sample: stale?.slice(0, 5) }));