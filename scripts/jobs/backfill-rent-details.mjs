/**
 * Backfill de comparables de alquiler incompletos (sqm / dormitorios / CP).
 *
 * Los alquileres importados de pisos.com vienen sin m² ni dormitorios (el
 * JSON-LD de listado no los trae) y a veces sin CP. Sin ellos, la estimación
 * de renta por comparable pierde precisión y el filtro de dormitorios no aplica.
 *
 * Uso:
 *   node --env-file=.env.local scripts/jobs/backfill-rent-details.mjs --limit 200
 *   RENT_BACKFILL_CONCURRENCY=3
 */
import { getSupabase } from "../scrapers/lib/env.mjs";
import { fetchPisosDetailFields } from "../scrapers/lib/parse-pisos-ld.mjs";

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = Number(limitArg?.split("=")[1] ?? process.env.RENT_BACKFILL_LIMIT ?? "200");
const CONCURRENCY = Math.min(4, Math.max(1, Number(process.env.RENT_BACKFILL_CONCURRENCY ?? "3")));
const pauseMs = Number(process.env.RENT_BACKFILL_PAUSE_MS ?? "400");

const supabase = getSupabase();

const { data: rows, error } = await supabase
  .from("listings")
  .select("id,source_url,sqm,bedrooms,postal_code")
  .eq("operation", "rent")
  .eq("status", "active")
  .eq("source_portal", "pisos_com")
  .or("sqm.is.null,bedrooms.is.null,postal_code.is.null")
  .order("created_at", { ascending: false })
  .limit(LIMIT);
if (error) {
  console.error(error.message);
  process.exit(1);
}

async function fixOne(row) {
  if (!row.source_url) return { ok: false, reason: "no_url" };
  for (let attempt = 0; attempt < 2; attempt++) {
    const d = await fetchPisosDetailFields(row.source_url);
    if (!d) continue;
    const patch = {};
    if (d.sqm && row.sqm == null) patch.sqm = d.sqm;
    if (d.bedrooms && row.bedrooms == null) patch.bedrooms = d.bedrooms;
    if (d.postalCode && row.postal_code == null) patch.postal_code = d.postalCode;
    if (!Object.keys(patch).length) return { ok: true, changed: false };
    const { error: upErr } = await supabase.from("listings").update(patch).eq("id", row.id);
    if (!upErr) return { ok: true, changed: true, patch };
    if (attempt === 1) return { ok: false, reason: upErr.message };
  }
  return { ok: false, reason: "no_detail" };
}

let changed = 0;
let failed = 0;
let i = 0;
async function worker() {
  while (i < rows.length) {
    const row = rows[i++];
    try {
      const r = await fixOne(row);
      if (r.changed) changed++;
      if (!r.ok) failed++;
    } catch {
      failed++;
    }
    await new Promise((r) => setTimeout(r, pauseMs));
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

console.log(
  JSON.stringify({ ok: true, scanned: rows.length, changed, failed, concurrency: CONCURRENCY })
);
