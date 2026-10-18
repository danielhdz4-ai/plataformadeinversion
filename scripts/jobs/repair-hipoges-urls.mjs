/**
 * Corrige enlaces rotos /es/asset/… → /es/detail/… (Hipoges cambió rutas).
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);
const BATCH = Number(process.env.REPAIR_BATCH ?? "500");
const offset = Number(process.env.REPAIR_OFFSET ?? "0");

const { data: rows, error } = await supabase
  .from("listings")
  .select("id, source_url, source_external_id")
  .eq("source_portal", "hipoges")
  .eq("status", "active")
  .order("id", { ascending: true })
  .range(offset, offset + BATCH - 1);

if (error) {
  console.error(error.message);
  process.exit(1);
}

const BASE = "https://realestate.hipoges.com";
let updated = 0;
let skipped = 0;

for (const row of rows ?? []) {
  const oldUrl = row.source_url ?? "";
  if (oldUrl.includes("/es/detail/")) {
    skipped++;
    continue;
  }
  let code = null;
  const assetMatch = oldUrl.match(/\/es\/asset\/([^/?#]+)/i);
  if (assetMatch) code = decodeURIComponent(assetMatch[1]);
  if (!code && row.source_external_id) code = String(row.source_external_id);
  if (!code) {
    skipped++;
    continue;
  }
  const nextUrl = `${BASE}/es/detail/${encodeURIComponent(code)}`;
  if (nextUrl === oldUrl) {
    skipped++;
    continue;
  }
  const { error: upErr } = await supabase
    .from("listings")
    .update({ source_url: nextUrl, scraped_at: new Date().toISOString() })
    .eq("id", row.id);
  if (!upErr) updated++;
}

console.log(JSON.stringify({ ok: true, scanned: rows?.length ?? 0, updated, skipped }));
