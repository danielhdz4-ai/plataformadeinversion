import { getSupabase } from "./env.mjs";

const RESIDENTIAL = new Set(["fotocasa", "pisos_com", "kelify", "habitaclia"]);

/** Marca presencia en barrio + last_seen_at tras upsert en ingestión. */
export async function touchListingInZones(listingId, zoneSlugs, seenAt = new Date()) {
  if (!listingId || !zoneSlugs?.length) return;
  const supabase = getSupabase();
  const iso = seenAt.toISOString();
  await supabase.from("listings").update({ last_seen_at: iso, scraped_at: iso }).eq("id", listingId);
  const rows = zoneSlugs.map((zone_slug) => ({
    zone_slug,
    listing_id: listingId,
    last_seen_at: iso,
  }));
  await supabase.from("listing_zone_presence").upsert(rows, { onConflict: "zone_slug,listing_id" });
}

export async function touchListingsInPolygon(polygonGeojson, zoneSlugs, sinceIso) {
  const supabase = getSupabase();
  const { data: inPoly, error } = await supabase.rpc("listings_in_polygon", {
    geojson: polygonGeojson,
  });
  if (error || !inPoly?.length) return { touched: 0 };

  const ids = inPoly.map((r) => r.id);
  const { data: rows } = await supabase
    .from("listings")
    .select("id, source_portal")
    .in("id", ids)
    .eq("status", "active")
    .eq("operation", "sale")
    .gte("scraped_at", sinceIso);

  let touched = 0;
  for (const row of rows ?? []) {
    if (!RESIDENTIAL.has(row.source_portal)) continue;
    await touchListingInZones(row.id, zoneSlugs, new Date(sinceIso));
    touched++;
  }
  return { touched };
}
