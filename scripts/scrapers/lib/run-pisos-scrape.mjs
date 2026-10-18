import { dryRun, getSupabase, maxListings } from "./env.mjs";
import { fetchPisosDetailFields, parsePisosListingsFromHtml } from "./parse-pisos-ld.mjs";
import { isPlausibleMonthlyRent } from "./rent-plausible.mjs";
import { getCityConfig } from "./spain-city.mjs";

const PORTAL = "pisos_com";

function pisosMaxPages() {
  const n = Number(process.env.PISOS_MAX_PAGES ?? "25");
  return Number.isFinite(n) && n > 0 ? Math.min(n, 60) : 25;
}

function pisosSaleSearchUrls(pisosSlug, maxPages, district = null) {
  const urls = [];
  const base =
    district != null && district !== ""
      ? `https://www.pisos.com/venta/pisos-${pisosSlug}/${district}/`
      : `https://www.pisos.com/venta/pisos-${pisosSlug}/`;
  for (let p = 1; p <= maxPages; p++) {
    urls.push(p === 1 ? base : `${base}${p}/`);
  }
  return urls;
}

export async function runPisosSale(citySlug, options = {}) {
  const city = getCityConfig(citySlug);
  const district = options.district ?? null;
  const pageCap = options.maxPages ?? pisosMaxPages();
  const supabase = getSupabase();
  const runCitySlug = district ? `${city.slug}/${district}` : city.slug;
  const { data: run, error: runErr } = await supabase
    .from("scrape_runs")
    .insert({ source: PORTAL, city_slug: runCitySlug, status: "running" })
    .select("id")
    .single();
  if (runErr) throw runErr;

  const searchUrls = pisosSaleSearchUrls(city.pisosSlug, pageCap, district);

  try {
    const limit = options.maxListings ?? maxListings();
    const parsed = [];
    const seen = new Set();
    let emptyPages = 0;
    for (const url of searchUrls) {
      if (parsed.length >= limit) break;
      if (emptyPages >= 2) break;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PlataformaInversion/0.1)",
          Accept: "text/html",
          "Accept-Language": "es-ES,es;q=0.9",
        },
      });
      if (!res.ok) {
        emptyPages++;
        continue;
      }
      const parseOpts = { max: limit - parsed.length, bbox: city.bbox };
      if (city.regionPattern) parseOpts.regionPattern = city.regionPattern;
      const batch = parsePisosListingsFromHtml(await res.text(), parseOpts);
      if (batch.length === 0) emptyPages++;
      else emptyPages = 0;
      for (const row of batch) {
        if (seen.has(row.externalId)) continue;
        seen.add(row.externalId);
        parsed.push(row);
      }
    }
    if (parsed.length === 0) throw new Error(`No listings parsed for ${city.slug}`);

    let inserted = 0;
    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i];
      let price = row.price;
      let sqm = row.sqm;
      if (price == null && row.sourceUrl) {
        const detail = await fetchPisosDetailFields(row.sourceUrl);
        if (detail?.price) price = detail.price;
        if (detail?.sqm && sqm == null) sqm = detail.sqm;
        if (i > 0 && i % 4 === 0) await new Promise((r) => setTimeout(r, 280));
      }
      if (price == null || price < 5000) continue;
      const payload = {
        source_portal: PORTAL,
        source_external_id: String(row.externalId),
        operation: "sale",
        title: row.title,
        price,
        sqm: sqm ?? null,
        bedrooms: row.bedrooms ?? null,
        bathrooms: row.bathrooms ?? null,
        thumbnail_url: row.thumbnail ?? null,
        postal_code: row.postalCode ?? null,
        city: row.city ?? city.name,
        ccaa: city.ccaa,
        source_url: row.sourceUrl,
        geocode_quality: 4,
        status: "active",
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
          lon: row.lon,
          lat: row.lat,
        });
        inserted++;
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

    await supabase.from("coverage_regions").upsert(
      {
        slug: city.slug,
        name: city.name,
        tier: city.tier,
        last_scrape_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    );

    return {
      ok: true,
      city: city.slug,
      district: district ?? null,
      parsed: parsed.length,
      inserted,
      externalIds: [...seen],
      dryRun: dryRun(),
    };
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

export async function runPisosRent(citySlug) {
  const city = getCityConfig(citySlug);
  const supabase = getSupabase();
  const { data: run } = await supabase
    .from("scrape_runs")
    .insert({ source: `${PORTAL}-rent`, city_slug: city.slug, status: "running" })
    .select("id")
    .single();

  try {
    const limit = maxListings();
    const parsed = [];
    const seen = new Set();
    let emptyPages = 0;
    for (let p = 1; p <= pisosMaxPages(); p++) {
      if (parsed.length >= limit) break;
      if (emptyPages >= 2) break;
      const url =
        p === 1
          ? `https://www.pisos.com/alquiler/pisos-${city.pisosSlug}/`
          : `https://www.pisos.com/alquiler/pisos-${city.pisosSlug}/${p}/`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PlataformaInversion/0.1)",
          Accept: "text/html",
          "Accept-Language": "es-ES,es;q=0.9",
        },
      });
      if (!res.ok) {
        emptyPages++;
        continue;
      }
      const parseOpts = { operation: "rent", max: limit - parsed.length, bbox: city.bbox };
      if (city.regionPattern) parseOpts.regionPattern = city.regionPattern;
      const batch = parsePisosListingsFromHtml(await res.text(), parseOpts);
      if (batch.length === 0) emptyPages++;
      else emptyPages = 0;
      for (const row of batch) {
        if (seen.has(row.externalId)) continue;
        seen.add(row.externalId);
        parsed.push(row);
      }
    }
    if (parsed.length === 0) throw new Error(`No rent listings parsed for ${city.slug}`);
    let inserted = 0;
    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i];
      let rent = row.price;
      let sqm = row.sqm;
      if (rent == null && row.sourceUrl) {
        const detail = await fetchPisosDetailFields(row.sourceUrl);
        if (detail?.price) rent = detail.price;
        if (detail?.sqm && sqm == null) sqm = detail.sqm;
      }
      if (rent == null || !isPlausibleMonthlyRent(rent)) continue;
      const payload = {
        source_portal: PORTAL,
        source_external_id: `rent-${row.externalId}`,
        operation: "rent",
        title: row.title,
        price: rent,
        sqm: sqm ?? null,
        bedrooms: row.bedrooms ?? null,
        postal_code: row.postalCode ?? null,
        city: row.city ?? city.name,
        ccaa: city.ccaa,
        source_url: row.sourceUrl,
        thumbnail_url: row.thumbnail ?? null,
        status: "active",
        geocode_quality: 4,
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
          lon: row.lon,
          lat: row.lat,
        });
        inserted++;
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
    return { ok: true, city: city.slug, inserted, dryRun: dryRun() };
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
