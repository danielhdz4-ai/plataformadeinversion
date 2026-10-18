function bboxFromCenter(lat, lng, radiusKm) {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return {
    minLng: lng - dLng,
    minLat: lat - dLat,
    maxLng: lng + dLng,
    maxLat: lat + dLat,
  };
}

/** Archiva anuncios del portal en el bbox del barrio que no aparecieron en el último scrape. */
export async function archiveUnseenInZone(supabase, {
  sourcePortal,
  zoneCenter,
  zoneRadiusKm = 2.2,
  seenExternalIds,
  minSeen = 8,
}) {
  if (!zoneCenter?.lat || !zoneCenter?.lng) return { archived: 0, skipped: "no_center" };
  if (seenExternalIds.size < minSeen) return { archived: 0, skipped: "too_few_seen" };

  const box = bboxFromCenter(zoneCenter.lat, zoneCenter.lng, zoneRadiusKm);
  const { data: inBox, error: boxErr } = await supabase.rpc("listings_in_bbox", {
    min_lng: box.minLng,
    min_lat: box.minLat,
    max_lng: box.maxLng,
    max_lat: box.maxLat,
  });
  if (boxErr || !inBox?.length) return { archived: 0, scanned: 0, error: boxErr?.message };

  const ids = inBox.map((r) => r.id);
  const { data: rows, error } = await supabase
    .from("listings")
    .select("id, source_external_id")
    .in("id", ids)
    .eq("source_portal", sourcePortal)
    .eq("status", "active")
    .eq("operation", "sale");

  if (error || !rows?.length) return { archived: 0, scanned: inBox.length, error: error?.message };

  const toArchive = rows
    .filter((r) => !seenExternalIds.has(String(r.source_external_id)))
    .map((r) => r.id);

  if (toArchive.length === 0) return { archived: 0, scanned: rows.length };

  const { error: upErr } = await supabase
    .from("listings")
    .update({ status: "archived", scraped_at: new Date().toISOString() })
    .in("id", toArchive);

  return { archived: upErr ? 0 : toArchive.length, scanned: rows.length, error: upErr?.message };
}
