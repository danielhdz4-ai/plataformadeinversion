/**
 * Ingestión completa de un scan (polígono) + precompute ROI + ranking vía API.
 * Uso: node scripts/jobs/scan-zone-ingest-by-id.mjs <scan_id>
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ingestZoneForPolygon } from "../scrapers/lib/zone-ingest.mjs";
import { normalizeIngestPortals } from "../scrapers/lib/all-portals.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const scanId = process.argv[2] || process.env.SCAN_ID;
if (!scanId) {
  console.error("Usage: node scripts/jobs/scan-zone-ingest-by-id.mjs <scan_id>");
  process.exit(1);
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

const { data: scanRow, error } = await supabase
  .from("scans")
  .select("polygon, filters, operation, status")
  .eq("id", scanId)
  .single();

if (error || !scanRow?.polygon) {
  console.error("Scan not found or missing polygon", error?.message);
  process.exit(1);
}

const polygon = scanRow.polygon;
const filters = scanRow.filters ?? {};
const portalsRaw = filters.sourcePortals;
const portals = normalizeIngestPortals(
  Array.isArray(portalsRaw) && portalsRaw.length ? portalsRaw : undefined
);

await supabase
  .from("scans")
  .update({
    status: "running",
    progress_pct: 15,
    error_message: "Importando anuncios del barrio (GitHub Actions)…",
  })
  .eq("id", scanId);

process.env.SCAN_CP_SKIP_PLAYWRIGHT = process.env.SCAN_CP_SKIP_PLAYWRIGHT ?? "1";

let ingest;
try {
  ingest = await ingestZoneForPolygon(polygon, { scanId, portals });
  console.log(JSON.stringify({ phase: "ingest", ...ingest }));
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  ingest = { ok: false, error: msg };
  console.log(JSON.stringify({ phase: "ingest", ok: false, error: msg }));
}

await supabase.from("scans").update({ progress_pct: 55 }).eq("id", scanId);

process.env.POLYGON_GEOJSON = JSON.stringify(polygon);
const pre = spawnSync(process.execPath, ["scripts/jobs/precompute-roi-polygon.mjs"], {
  cwd: root,
  env: { ...process.env },
  stdio: "pipe",
});
if (pre.status !== 0) {
  console.warn("precompute-roi-polygon exit", pre.status, pre.stderr?.toString()?.slice(0, 300));
}

const site =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://plataformadeinversion-three.vercel.app";
const cron = process.env.CRON_SECRET;
if (!cron) {
  console.error("Missing CRON_SECRET for rank callback");
  await supabase
    .from("scans")
    .update({ status: "failed", error_message: "CRON_SECRET missing in Actions" })
    .eq("id", scanId);
  process.exit(1);
}

const rankRes = await fetch(`${site}/api/scans/${scanId}/rank`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${cron}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    ingest: {
      ok: ingest?.ok,
      error: ingest?.error,
      inPolygonAfter: ingest?.inPolygonAfter,
      target: ingest?.target,
      meetsTarget: ingest?.meetsTarget,
    },
  }),
});

const rankBody = await rankRes.text();
console.log(JSON.stringify({ phase: "rank", status: rankRes.status, body: rankBody.slice(0, 500) }));

if (!rankRes.ok) {
  await supabase
    .from("scans")
    .update({
      status: "failed",
      progress_pct: 0,
      error_message: `Ranking falló (${rankRes.status})`,
    })
    .eq("id", scanId);
  process.exit(1);
}

if (ingest?.ok === false && ingest?.error) {
  await supabase
    .from("scans")
    .update({
      error_message: `Importación parcial: ${ingest.error}. Ranking generado con inventario existente.`,
    })
    .eq("id", scanId);
}

process.exit(0);
