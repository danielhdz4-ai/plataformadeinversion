import { dryRun, getSupabase, maxListings } from "./env.mjs";
import { geocodeSpain } from "./geocode-es.mjs";
import {
  HABITACLIA_SALE_ZONES,
  createHabitacliaBrowser,
  fetchHabitacliaWithBrowser,
  zoneFallbackGeo,
} from "./habitaclia-api.mjs";

const PORTAL = "habitaclia";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runHabitacliaSale() {
  const supabase = getSupabase();
  const { data: run, error: runErr } = await supabase
    .from("scrape_runs")
    .insert({ source: PORTAL, city_slug: "espana", status: "running" })
    .select("id")
    .single();
  if (runErr) throw runErr;

  const limit = maxListings();
  const maxPages = Number(process.env.HABITACLIA_MAX_PAGES ?? "3");
  const zoneFilter = process.env.HABITACLIA_ZONES?.split(",").map((s) => s.trim()).filter(Boolean);
  let zones = HABITACLIA_SALE_ZONES;
  if (zoneFilter?.length) {
    zones = zones.filter((z) => zoneFilter.some((f) => z.path.includes(f)));
  }

  let inserted = 0;
  let cards = 0;

  const browser = await createHabitacliaBrowser();
  try {
    for (const zone of zones) {
      if (inserted >= limit) break;
      let zoneGeo =
        (await geocodeSpain(`${zone.name}, España`)) ??
        (await geocodeSpain(`${zone.name}, ${zone.ccaa}, España`)) ??
        zoneFallbackGeo(zone);
      if (!zoneGeo) continue;

      for (let pageNum = 1; pageNum <= maxPages && inserted < limit; pageNum++) {
        const { listings } = await fetchHabitacliaWithBrowser(browser, zone.path, pageNum);
        if (listings.length === 0) break;
        cards += listings.length;

        for (const mapped of listings) {
          if (inserted >= limit) break;
          if (!mapped.externalId || mapped.price == null || mapped.price < 5000) continue;

          const payload = {
            source_portal: PORTAL,
            source_external_id: mapped.externalId,
            operation: "sale",
            title: mapped.title,
            price: mapped.price,
            sqm: mapped.sqm,
            bedrooms: mapped.bedrooms,
            bathrooms: mapped.bathrooms,
            city: zone.name,
            ccaa: zone.ccaa,
            source_url: mapped.sourceUrl,
            thumbnail_url: mapped.thumbnail,
            status: "active",
            geocode_quality: 4,
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
              lon: zoneGeo.lon,
              lat: zoneGeo.lat,
            });
            inserted++;
          }
        }
        await sleep(Number(process.env.PAUSE_MS ?? "2000"));
      }
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
  } finally {
    await browser.close();
  }
}
