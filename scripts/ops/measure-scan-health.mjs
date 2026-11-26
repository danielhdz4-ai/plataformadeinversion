/**
 * Métricas rápidas: scans recientes, zone ingest, cobertura CP tier1.
 * node scripts/ops/measure-scan-health.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const envLocal = join(root, ".env.local");
let url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  try {
    const raw = readFileSync(envLocal, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.+)$/);
      if (!m) continue;
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (m[1] === "NEXT_PUBLIC_SUPABASE_URL") url = val;
      if (m[1] === "SUPABASE_SERVICE_ROLE_KEY") key = val;
    }
  } catch {
    /* ignore */
  }
}

if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const supabase = createClient(url, key);
const since = new Date(Date.now() - 7 * 864e5).toISOString();

const { data: scans } = await supabase
  .from("scans")
  .select("id, status, progress_pct, error_message, created_at")
  .gte("created_at", since)
  .order("created_at", { ascending: false })
  .limit(40);

const byStatus = {};
for (const s of scans ?? []) {
  byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
}

const { data: ingests } = await supabase
  .from("zone_ingest_runs")
  .select("id, status, in_polygon_after, listings_upserted, finished_at, scan_id")
  .order("finished_at", { ascending: false, nullsFirst: false })
  .limit(20);

const { count: activeSale } = await supabase
  .from("listings")
  .select("id", { count: "exact", head: true })
  .eq("status", "active")
  .eq("operation", "sale");

const { count: withSqm } = await supabase
  .from("listings")
  .select("id", { count: "exact", head: true })
  .eq("status", "active")
  .eq("operation", "sale")
  .not("sqm", "is", null)
  .gt("sqm", 0);

const sqmPct =
  activeSale && activeSale > 0 ? Math.round(((withSqm ?? 0) / activeSale) * 1000) / 10 : null;

console.log(
  JSON.stringify(
    {
      window: "7d",
      scans: { total: scans?.length ?? 0, byStatus, recent: scans?.slice(0, 8) },
      zoneIngestRuns: ingests,
      inventory: {
        activeSale: activeSale ?? 0,
        withSqm: withSqm ?? 0,
        sqmPct,
      },
    },
    null,
    2
  )
);
