/**
 * B6 — Archiva duplicados cross-portal (RC catastro o heurística CP/precio/m²).
 * Prioridad: kelify > pisos.com > otros; luego scraped_at más reciente.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);
const MAX = Number(process.env.DEDUP_BATCH ?? "3000");

const PORTAL_RANK = {
  kelify: 3,
  "pisos.com": 2,
  pisos: 2,
  pisos_com: 2,
  hipoges: 2,
  solvia: 2,
  fotocasa: 1,
  habitaclia: 1,
  idealista: 1,
};

function rank(portal) {
  return PORTAL_RANK[portal?.toLowerCase?.()] ?? 0;
}

function dedupKey(row) {
  const pc = (row.postal_code ?? "").slice(0, 5);
  const priceBucket = Math.round(Number(row.price) / 2000);
  const sqm = Number(row.sqm) || 0;
  const sqmBucket = Math.round(sqm / 8);
  const beds = row.bedrooms ?? -1;
  return `${pc}|${priceBucket}|${sqmBucket}|${beds}`;
}

function normalizeRc(rc) {
  if (!rc) return null;
  const n = String(rc).replace(/\s+/g, "").toUpperCase();
  return n.length >= 14 ? n : null;
}

function pickLosers(list) {
  if (list.length < 2) return [];
  if (list.every((x) => x.source_portal === "kelify")) return [];
  list.sort((a, b) => {
    const dr = rank(b.source_portal) - rank(a.source_portal);
    if (dr !== 0) return dr;
    return new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime();
  });
  const losers = [];
  for (const loser of list.slice(1)) {
    if (loser.source_portal === "kelify") continue;
    losers.push(loser.id);
  }
  return losers;
}

const { data: rows, error } = await supabase
  .from("listings")
  .select("id, source_portal, price, sqm, bedrooms, postal_code, scraped_at")
  .eq("operation", "sale")
  .eq("status", "active")
  .limit(MAX);

if (error) {
  console.error(error.message);
  process.exit(1);
}

const ids = (rows ?? []).map((r) => r.id);
const rcByListing = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const chunk = ids.slice(i, i + 200);
  const { data: enrich } = await supabase
    .from("listing_enrichment")
    .select("listing_id, rc")
    .in("listing_id", chunk)
    .not("rc", "is", null);
  for (const e of enrich ?? []) {
    const rc = normalizeRc(e.rc);
    if (rc) rcByListing.set(e.listing_id, rc);
  }
}

const toArchive = new Set();
let rcGroups = 0;
let heuristicGroups = 0;

const rcGroupsMap = new Map();
for (const row of rows ?? []) {
  const rc = rcByListing.get(row.id);
  if (!rc) continue;
  const k = `rc:${rc}`;
  if (!rcGroupsMap.has(k)) rcGroupsMap.set(k, []);
  rcGroupsMap.get(k).push(row);
}

for (const [, list] of rcGroupsMap) {
  if (list.length < 2) continue;
  rcGroups++;
  for (const id of pickLosers(list)) toArchive.add(id);
}

const groups = new Map();
for (const row of rows ?? []) {
  if (toArchive.has(row.id)) continue;
  const k = dedupKey(row);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(row);
}

for (const [, list] of groups) {
  if (list.length < 2) continue;
  heuristicGroups++;
  for (const id of pickLosers(list)) toArchive.add(id);
}

const archiveIds = [...toArchive];
if (archiveIds.length === 0) {
  console.log(
    JSON.stringify({
      ok: true,
      archived: 0,
      scanned: rows?.length ?? 0,
      rcGroups,
      heuristicGroups,
    })
  );
  process.exit(0);
}

const { error: upErr } = await supabase
  .from("listings")
  .update({ status: "archived" })
  .in("id", archiveIds);

if (upErr) {
  console.error(upErr.message);
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    archived: archiveIds.length,
    scanned: rows?.length ?? 0,
    rcGroups,
    heuristicGroups,
  })
);
