/** Estado reciente de scrape_runs por portal (fallos / cero inserts). */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
for (const p of [join(root, ".env.local"), join(root, "apps/web/.env.local")]) {
  try {
    const raw = readFileSync(p, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.+)$/);
      if (!m) continue;
      const v = m[2].trim().replace(/^["']|["']$/g, "");
      if (m[1].startsWith("NEXT_PUBLIC")) process.env.NEXT_PUBLIC_SUPABASE_URL = v;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = v;
    }
  } catch {
    /* skip */
  }
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const sb = createClient(url, key);
const since = new Date(Date.now() - 7 * 864e5).toISOString();

const { data: runs } = await sb
  .from("scrape_runs")
  .select("source, city_slug, status, listings_inserted, error_message, started_at")
  .gte("started_at", since)
  .order("started_at", { ascending: false })
  .limit(500);

const bySource = {};
for (const r of runs ?? []) {
  const src = r.source ?? "?";
  if (!bySource[src]) {
    bySource[src] = { completed: 0, failed: 0, running: 0, inserted: 0, lastError: null };
  }
  const b = bySource[src];
  if (r.status === "completed") b.completed++;
  else if (r.status === "failed") {
    b.failed++;
    if (!b.lastError && r.error_message) b.lastError = r.error_message.slice(0, 120);
  } else if (r.status === "running") b.running++;
  b.inserted += Number(r.listings_inserted ?? 0);
}

console.log(JSON.stringify({ since, runs: runs?.length ?? 0, bySource }, null, 2));
