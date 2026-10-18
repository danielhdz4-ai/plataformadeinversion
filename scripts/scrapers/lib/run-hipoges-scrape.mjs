import { dryRun, getSupabase, maxListings } from "./env.mjs";
import { geocodeSpain } from "./geocode-es.mjs";
import {
  createHipogesSession,
  fetchHipogesListingPage,
  mapHipogesAsset,
  spainSaleQuery,
} from "./hipoges-api.mjs";

const PORTAL = "hipoges";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runHipogesSale() {
  const supabase = getSupabase();
  const { data: run, error: runErr } = await supabase
    .from("scrape_runs")
    .insert({ source: PORTAL, city_slug: "espana", status: "running" })
    .select("id")
    .single();
  if (runErr) throw runErr;

  const limit = maxListings();
  const pageSize = Number(process.env.HIPOGES_PAGE_SIZE ?? "40");
  let session = await createHipogesSession();
  let page = 1;
  let inserted = 0;
  let cards = 0;

  try {
    while (inserted < limit) {
      let data;
      try {
        data = await fetchHipogesListingPage(session, {
          page,
          itemsPerPage: pageSize,
          query: spainSaleQuery(),
        });
      } catch (e) {
        session = await createHipogesSession();
        data = await fetchHipogesListingPage(session, {
          page,
          itemsPerPage: pageSize,
          query: spainSaleQuery(),
        });
      }
      const rows = data.result ?? [];
      if (rows.length === 0) break;
      cards += rows.length;

      for (const raw of rows) {
        if (inserted >= limit) break;
        const mapped = mapHipogesAsset(raw);
        if (!mapped?.externalId || mapped.price == null || mapped.price < 25_000) continue;

        let lon = mapped.lon;
        let lat = mapped.lat;
        let geocodeQuality = lon != null && lat != null ? 3 : 4;
        if (lon == null || lat == null) {
          const geo = await geocodeSpain(`${mapped.title}, ${mapped.city ?? "España"}`);
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
          title: mapped.title.slice(0, 200),
          price: mapped.price,
          sqm: mapped.sqm != null ? Number(mapped.sqm) : null,
          bedrooms: mapped.bedrooms != null ? Number(mapped.bedrooms) : null,
          bathrooms: mapped.bathrooms != null ? Number(mapped.bathrooms) : null,
          city: mapped.city,
          ccaa: mapped.ccaa,
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

      const total = Number(data.total ?? 0);
      if (page * pageSize >= total) break;
      page++;
      await sleep(Number(process.env.PAUSE_MS ?? "800"));
    }

    await supabase
      .from("scrape_runs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        listings_inserted: inserted,
      })
      .eq("id", run.id);

    return { ok: true, portal: PORTAL, cards, inserted, pages: page, dryRun: dryRun() };
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
