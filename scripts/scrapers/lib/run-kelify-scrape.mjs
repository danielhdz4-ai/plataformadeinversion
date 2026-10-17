import { chromium } from "playwright";
import { dryRun, getSupabase, maxListings } from "./env.mjs";
import { geocodeSpain } from "./geocode-es.mjs";
import { kelifyLoginIfConfigured } from "./kelify-auth.mjs";
import {
  collectKelifyCards,
  discoverKelifySubListUrls,
  parseKelifyCardsFromHtml,
  sleep,
} from "./kelify-collect.mjs";
import { collectKelifyCardsViaFetch, fetchKelifyListHtml } from "./kelify-fetch-list.mjs";
import { fetchKelifyDetail } from "./kelify-parse-detail.mjs";
import { kelifyListingUrls } from "./kelify-urls.mjs";
import { getCityConfig } from "./spain-city.mjs";

const PORTAL = "kelify";

function parsePrice(text) {
  const m = text.match(/([\d.]+)\s*€/);
  if (!m) return null;
  return Number(m[1].replace(/\./g, ""));
}

function titleFromKelifyCard(card) {
  const t = (card.text ?? "").replace(/\s+/g, " ").trim();
  const beforePrice = t.split(/\d[\d.]*\s*€/)[0]?.trim();
  if (beforePrice && beforePrice.length >= 10 && beforePrice.length <= 140) {
    const cleaned = beforePrice.replace(/^\d+\s*\/\s*\d+\s*/, "").trim();
    if (cleaned.length >= 8) return cleaned;
  }
  const slug = card.href.split("/").pop()?.replace(/-[A-Za-z0-9]+$/, "").replace(/-/g, " ");
  return slug && slug.length > 3 ? slug : `Kelify ${card.propertyId}`;
}

export async function runKelifySale(citySlug) {
  const city = getCityConfig(citySlug);
  const supabase = getSupabase();
  const { data: run, error: runErr } = await supabase
    .from("scrape_runs")
    .insert({ source: PORTAL, city_slug: city.slug, status: "running" })
    .select("id")
    .single();
  if (runErr) throw runErr;

  const limit = maxListings();
  const scrollRounds = Number(process.env.KELIFY_SCROLL_ROUNDS ?? "45");

  try {
    const listUrls = new Set(kelifyListingUrls(city));
    const unique = [];
    const seen = new Set();

    const fetched = await collectKelifyCardsViaFetch(city, limit);
    for (const c of fetched) {
      if (seen.has(c.propertyId)) continue;
      seen.add(c.propertyId);
      unique.push(c);
    }

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await kelifyLoginIfConfigured(page);

    for (const startUrl of listUrls) {
      if (unique.length >= limit) break;
      try {
        await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
        await page.waitForSelector("[data-property-card], a[href*='/venta/pisos/']", {
          timeout: 35_000,
        });
      } catch {
        continue;
      }
      await sleep(1200);
      for (const sub of await discoverKelifySubListUrls(page, city)) {
        listUrls.add(sub);
      }
      const batch = await collectKelifyCards(page, city, limit - unique.length, { scrollRounds });
      for (const c of batch) {
        if (seen.has(c.propertyId)) continue;
        seen.add(c.propertyId);
        unique.push(c);
      }
    }

    for (const subUrl of listUrls) {
      if (unique.length >= limit) break;
      if (kelifyListingUrls(city).includes(subUrl)) continue;
      const subHtml = await fetchKelifyListHtml(subUrl);
      if (subHtml) {
        for (const c of parseKelifyCardsFromHtml(subHtml, city, limit - unique.length, seen)) {
          unique.push(c);
        }
      }
      if (unique.length >= limit) break;
      try {
        await page.goto(subUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
        await page.waitForSelector("[data-property-card]", { timeout: 25_000 });
      } catch {
        continue;
      }
      await sleep(800);
      const batch = await collectKelifyCards(page, city, limit - unique.length, {
        scrollRounds: Math.min(scrollRounds, 25),
      });
      for (const c of batch) {
        if (seen.has(c.propertyId)) continue;
        seen.add(c.propertyId);
        unique.push(c);
      }
    }

    await browser.close();

    if (unique.length === 0) throw new Error(`Kelify: sin tarjetas en ${city.slug}`);

    await supabase.from("kelify_crawl_runs").insert({
      city_slug: city.slug,
      list_url: [...listUrls][0] ?? null,
      cards_found: unique.length,
      upserted: 0,
      finished_at: null,
    });

    const centerLon = (city.bbox[0] + city.bbox[2]) / 2;
    const centerLat = (city.bbox[1] + city.bbox[3]) / 2;

    let inserted = 0;
    let lastUpsertError = null;
    async function upsertKelifyListing(payload) {
      let { data, error } = await supabase
        .from("listings")
        .upsert(payload, { onConflict: "source_portal,source_external_id" })
        .select("id")
        .maybeSingle();
      if (error?.message?.includes("kelify_hydrated")) {
        const { kelify_hydrated: _drop, ...rest } = payload;
        ({ data, error } = await supabase
          .from("listings")
          .upsert(rest, { onConflict: "source_portal,source_external_id" })
          .select("id")
          .maybeSingle());
      }
      return { data, error };
    }

    for (let i = 0; i < unique.length; i++) {
      const card = unique[i];
      const sourceUrl = card.href.startsWith("http") ? card.href : `https://kelify.com${card.href}`;
      let price = parsePrice(card.text);
      let title = titleFromKelifyCard(card);
      let sqm = null;
      let bedrooms = null;
      let bathrooms = null;
      let postalCode = null;
      let listingCity = city.name;
      let thumb = card.thumb;

      if (price == null || price < 5000) {
        const detail = await fetchKelifyDetail(sourceUrl);
        if (detail?.price) price = detail.price;
        if (detail?.title) title = detail.title;
        if (detail?.sqm) sqm = detail.sqm;
        if (detail?.bedrooms) bedrooms = detail.bedrooms;
        if (detail?.bathrooms) bathrooms = detail.bathrooms;
        if (detail?.postalCode) postalCode = detail.postalCode;
        if (detail?.city) listingCity = detail.city;
        if (detail?.thumbnailUrl) thumb = detail.thumbnailUrl;
        if (i > 0 && i % 3 === 0) await sleep(220);
      }
      if (price == null || price < 5000) continue;
      let lon = centerLon + ((i % 7) - 3) * 0.002;
      let lat = centerLat + ((i % 5) - 2) * 0.002;
      let geocodeQuality = 4;
      const zoneHint = title.match(/Aguadulce|Roquetas|El Ejido|Níjar|Carboneras/i)?.[0];
      const geoQuery = zoneHint
        ? `${zoneHint}, Almería, España`
        : `${title}, ${city.name}, España`;
      const geo = await geocodeSpain(geoQuery);
      if (geo) {
        lon = geo.lon;
        lat = geo.lat;
        geocodeQuality = 3;
      }
      if (i > 0 && i % 4 === 0) await sleep(280);

      const payload = {
        source_portal: PORTAL,
        source_external_id: card.propertyId,
        operation: "sale",
        title: title.slice(0, 200),
        price,
        sqm,
        bedrooms,
        bathrooms,
        postal_code: postalCode,
        city: listingCity,
        ccaa: city.ccaa,
        source_url: sourceUrl,
        thumbnail_url: thumb?.startsWith("http")
          ? thumb
          : thumb
            ? `https://kelify.com${thumb}`
            : null,
        status: "active",
        geocode_quality: geocodeQuality,
        kelify_hydrated: false,
        scraped_at: new Date().toISOString(),
      };

      if (dryRun()) {
        inserted++;
        continue;
      }

      const { data: upserted, error } = await upsertKelifyListing(payload);
      if (error) {
        lastUpsertError = error.message;
        continue;
      }
      inserted++;
      const listingId = upserted?.id;
      if (listingId) {
        await supabase.rpc("patch_listing_geom", { listing_id: listingId, lon, lat });
      }
    }

    if (inserted === 0 && unique.length > 0) {
      throw new Error(
        lastUpsertError
          ? `Kelify: 0 upserts (${unique.length} cards): ${lastUpsertError}`
          : `Kelify: 0 upserts con ${unique.length} tarjetas`
      );
    }

    await supabase
      .from("scrape_runs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        listings_inserted: inserted,
        error_message: inserted < unique.length && lastUpsertError ? `partial: ${lastUpsertError}` : null,
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

    return { ok: true, portal: PORTAL, city: city.slug, cards: unique.length, inserted, listUrls: listUrls.size };
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
