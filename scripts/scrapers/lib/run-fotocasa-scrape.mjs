import { dryRun, getSupabase, maxListings } from "./env.mjs";
import { geocodeSpain } from "./geocode-es.mjs";
import { FOTOCASA_SALE_ZONES, fetchFotocasaListPage } from "./fotocasa-api.mjs";

const PORTAL = "fotocasa";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runFotocasaSale() {
  const supabase = getSupabase();
  const { data: run, error: runErr } = await supabase
    .from("scrape_runs")
    .insert({ source: PORTAL, city_slug: "espana", status: "running" })
    .select("id")
    .single();
  if (runErr) throw runErr;

  const limit = maxListings();
  const maxPages = Number(process.env.FOTOCASA_MAX_PAGES ?? "5");
  const zoneFilter = process.env.FOTOCASA_ZONES?.split(",").map((s) => s.trim()).filter(Boolean);
  let zones = FOTOCASA_SALE_ZONES;
  if (zoneFilter?.length) zones = zones.filter((z) => zoneFilter.includes(z.slug));

  let inserted = 0;
  let cards = 0;

  try {
    for (const zone of zones) {
      if (inserted >= limit) break;
      let emptyStreak = 0;
      for (let page = 1; page <= maxPages && inserted < limit; page++) {
        const { listings } = await fetchFotocasaListPage(zone.slug, page);
        if (listings.length === 0) {
          emptyStreak++;
          if (emptyStreak >= 2) break;
          continue;
        }
        emptyStreak = 0;
        cards += listings.length;

        for (const mapped of listings) {
          if (inserted >= limit) break;
          if (!mapped.externalId || mapped.price == null) continue;

          let lon = mapped.lon;
          let lat = mapped.lat;
          let geocodeQuality = lon != null && lat != null ? 3 : 4;
          if (lon == null || lat == null) {
            const geo = await geocodeSpain(`${zone.name}, España`);
            if (geo) {
              lon = geo.lon;
              lat = geo.lat;
              geocodeQuality = 3;
            }
          }
          if (lon == null || lat == null) continue;

          const payload = {
            source_portal: PORTAL,
            source_external_id: mapped.externalId,
            operation: "sale",
            title: mapped.title,
            price: mapped.price,
            sqm: mapped.sqm != null ? Number(mapped.sqm) : null,
            bedrooms: mapped.bedrooms != null ? Number(mapped.bedrooms) : null,
            bathrooms: mapped.bathrooms != null ? Number(mapped.bathrooms) : null,
            city: mapped.city ?? zone.name,
            ccaa: zone.ccaa,
            postal_code: mapped.postalCode ?? null,
            source_url: mapped.sourceUrl,
            thumbnail_url: mapped.thumbnail,
            status: "active",
            geocode_quality: geocodeQuality,
            scraped_at: new Date().toISOString(),
          };

          if (dryRun()) {
            inserted++;
            continue;
          }
          const { data: upserted, error } = await supabase
            .from("listings")
            .upsert(payload, { onConflict: "source_portal,source_external_id" })
            .select("id")
            .maybeSingle();
          if (!error && upserted?.id) {
            await supabase.rpc("patch_listing_geom", {
              listing_id: upserted.id,
              lon,
              lat,
            });
            inserted++;
          }
        }
        await sleep(Number(process.env.PAUSE_MS ?? "900"));
      }
      await sleep(Number(process.env.PAUSE_MS ?? "900"));
    }

    await supabase
      .from("scrape_runs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        listings_inserted: inserted,
      })
      .eq("id", run.id);

    return { ok: true, portal: PORTAL, zones: zones.length, cards, inserted, dryRun: dryRun() };
  } catch (e) {
    await supabase
      .from("scrape_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: e instanceof Error ? e.message : String(e),
      })
      .eq("id", run.id);
    throw e;
  }
}
