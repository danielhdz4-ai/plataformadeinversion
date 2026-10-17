/**
 * B2 G2 — Refina geom con RC Catastro para listings con geocode_quality >= 4 y geom existente.
 */
import { createClient } from "@supabase/supabase-js";
import { fetchRcFromCoords } from "@pi/catastro-client";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);
const MAX = Number(process.env.CATASTRO_REFINE_MAX ?? "40");

const { data: rows } = await supabase
  .from("listings")
  .select("id")
  .eq("status", "active")
  .gte("geocode_quality", 4)
  .not("geom", "is", null)
  .limit(MAX);

let ok = 0;
for (const row of rows ?? []) {
  const { data: pins } = await supabase.rpc("listings_pins_by_ids", { ids: [row.id] });
  const pin = pins?.[0];
  if (!pin) continue;
  const rc = await fetchRcFromCoords(pin.lng, pin.lat);
  if (!rc) continue;
  await supabase.from("listing_enrichment").upsert(
    { listing_id: row.id, rc, raw: { source: "geocode-catastro-refine" } },
    { onConflict: "listing_id" }
  );
  await supabase.from("listings").update({ geocode_quality: 2 }).eq("id", row.id);
  ok++;
  await new Promise((r) => setTimeout(r, 350));
}

console.log(JSON.stringify({ ok: true, refined: ok, candidates: rows?.length ?? 0 }));
