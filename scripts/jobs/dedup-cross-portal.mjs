/**
 * B6 — Archiva duplicados cross-portal (misma zona + precio + m² aprox).
 * Prioridad: kelify > pisos.com > otros; luego scraped_at más reciente.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);
const MAX = Number(process.env.DEDUP_BATCH ?? "3000");

const PORTAL_RANK = { kelify: 3, "pisos.com": 2, pisos: 2, idealista: 1 };

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

const { data: rows, error } = await supabase
  .from("listings")
  .select("id, source_portal, price, sqm, bedrooms, postal_code, scraped_at")
  .eq("operation", "sale")
  .eq("status", "active")
  .not("postal_code", "is", null)
  .limit(MAX);

if (error) {
  console.error(error.message);
  process.exit(1);
}

const groups = new Map();
for (const row of rows ?? []) {
  const k = dedupKey(row);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(row);
}

const toArchive = [];
for (const [, list] of groups) {
  if (list.length < 2) continue;
  list.sort((a, b) => {
    const dr = rank(b.source_portal) - rank(a.source_portal);
    if (dr !== 0) return dr;
    return new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime();
  });
  for (const loser of list.slice(1)) toArchive.push(loser.id);
}

if (toArchive.length === 0) {
  console.log(JSON.stringify({ ok: true, archived: 0, scanned: rows?.length ?? 0 }));
  process.exit(0);
}

const { error: upErr } = await supabase
  .from("listings")
  .update({ status: "archived" })
  .in("id", toArchive);

if (upErr) {
  console.error(upErr.message);
  process.exit(1);
}

console.log(
  JSON.stringify({ ok: true, archived: toArchive.length, scanned: rows?.length ?? 0 })
);
