/**
 * Corrige precios/m² inventados (fallback antiguo del scraper pisos.com).
 */
import { createClient } from "@supabase/supabase-js";
import { fetchPisosDetailFields } from "../scrapers/lib/parse-pisos-ld.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);
const BATCH = Number(process.env.REPAIR_BATCH ?? "400");
const PAUSE = Number(process.env.PAUSE_MS ?? "350");

const offset = Number(process.env.REPAIR_OFFSET ?? "0");
const { data: rows, error } = await supabase
  .from("listings")
  .select("id, source_url, price, sqm, title")
  .eq("source_portal", "pisos_com")
  .eq("status", "active")
  .not("source_url", "is", null)
  .order("id", { ascending: true })
  .range(offset, offset + BATCH - 1);

if (error) {
  console.error(error.message);
  process.exit(1);
}

let updated = 0;
let skipped = 0;

for (let i = 0; i < (rows ?? []).length; i++) {
  const row = rows[i];
  if (!row.source_url?.includes("pisos.com")) {
    skipped++;
    continue;
  }
  const detail = await fetchPisosDetailFields(row.source_url);
  if (!detail?.price) {
    skipped++;
    continue;
  }
  const patch = { price: detail.price, scraped_at: new Date().toISOString() };
  if (detail.sqm) patch.sqm = detail.sqm;
  const priceDelta = Math.abs(Number(row.price) - detail.price);
  const sqmBad =
    detail.sqm != null &&
    (row.sqm == null || Math.abs(Number(row.sqm) - detail.sqm) > 3);
  if (priceDelta === 0 && !sqmBad) {
    skipped++;
    continue;
  }
  const { error: upErr } = await supabase.from("listings").update(patch).eq("id", row.id);
  if (!upErr) updated++;
  if (i > 0 && i % 3 === 0) await new Promise((r) => setTimeout(r, PAUSE));
}

console.log(JSON.stringify({ ok: true, scanned: rows?.length ?? 0, updated, skipped }));
