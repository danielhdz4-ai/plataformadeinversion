import { dryRun, getSupabase, maxListings } from "./env.mjs";
import { geocodeSpain } from "./geocode-es.mjs";
import { fetchSolviaProvinces, mapSolviaListing, searchSolviaProvince } from "./solvia-api.mjs";

const PORTAL = "solvia";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runSolviaSale() {
  const supabase = getSupabase();
  const { data: run, error: runErr } = await supabase
    .from("scrape_runs")
    .insert({ source: PORTAL, city_slug: "espana", status: "running" })
    .select("id")
    .single();
  if (runErr) throw runErr;

  const limit = maxListings();
  const pageSize = Number(process.env.SOLVIA_PAGE_SIZE ?? "24");
  const maxPages = Number(process.env.SOLVIA_MAX_PAGES ?? "8");
  const provinceFilter = process.env.SOLVIA_PROVINCE_IDS?.split(",").map((s) => s.trim()).filter(Boolean);

  let provinces = await fetchSolviaProvinces();
  if (provinceFilter?.length) {
    provinces = provinces.filter((p) => provinceFilter.includes(String(p.id)));
  }

  let inserted = 0;
  let cards = 0;

  try {
    for (const prov of provinces) {
      if (inserted >= limit) break;
      for (let page = 0; page < maxPages && inserted < limit; page++) {
        const data = await searchSolviaProvince(prov.id, { page, pageSize });
        const rows = data.inmuebles ?? [];
        if (rows.length === 0) break;
        const hayMore = data.paginacion?.hayPaginaSiguiente === true;
        cards += rows.length;

        for (const raw of rows) {
          if (inserted >= limit) break;
          const mapped = mapSolviaListing(raw);
          if (!mapped || mapped.price == null || mapped.price < 5000) continue;

          let lon = mapped.lon;
          let lat = mapped.lat;
          let geocodeQuality = lon != null && lat != null ? 3 : 4;
          if (lon == null || lat == null) {
            const geo = await geocodeSpain(`${mapped.city ?? prov.nombre}, España`);
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
            city: mapped.city ?? prov.nombre,
            ccaa: mapped.ccaa ?? prov.nombre,
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
        if (!hayMore) break;
        await sleep(Number(process.env.PAUSE_MS ?? "600"));
      }
      await sleep(Number(process.env.PAUSE_MS ?? "600"));
    }

    await supabase
      .from("scrape_runs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        listings_inserted: inserted,
      })
      .eq("id", run.id);

    return { ok: true, portal: PORTAL, provinces: provinces.length, cards, inserted, dryRun: dryRun() };
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
