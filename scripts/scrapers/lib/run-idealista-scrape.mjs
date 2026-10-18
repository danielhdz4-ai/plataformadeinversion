import { chromium } from "playwright";
import { dryRun, getSupabase, maxListings } from "./env.mjs";
import { geocodeSpain } from "./geocode-es.mjs";
import { idealistaListUrl } from "./idealista-urls.mjs";

const PORTAL = "idealista";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseEuro(text) {
  if (!text) return null;
  const m = String(text).match(/([\d.]+)\s*€/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, ""));
  return Number.isFinite(n) && n >= 5000 ? n : null;
}

/**
 * @param {{ citySlug: string, districtSlug: string, zoneName?: string, ccaa?: string }} zone
 */
export async function runIdealistaDistrictSale(zone) {
  const supabase = getSupabase();
  const runKey = `${zone.citySlug}/${zone.districtSlug}`;
  const { data: run, error: runErr } = await supabase
    .from("scrape_runs")
    .insert({ source: PORTAL, city_slug: runKey, status: "running" })
    .select("id")
    .single();
  if (runErr) throw runErr;

  const perDistrict = Number(process.env.IDEALISTA_PER_DISTRICT ?? "120");
  const maxPages = Number(process.env.IDEALISTA_MAX_PAGES ?? "6");
  const pauseMs = Number(process.env.IDEALISTA_PAUSE_MS ?? "1200");

  const proxy = process.env.IDEALISTA_PROXY_URL ?? process.env.HTTPS_PROXY ?? null;
  const launchOpts = { headless: true };
  if (proxy) launchOpts.proxy = { server: proxy };

  const seen = new Set();
  const parsed = [];
  let blocked = false;

  try {
    const browser = await chromium.launch(launchOpts);
    const context = await browser.newContext({
      locale: "es-ES",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      viewport: { width: 1365, height: 900 },
    });
    const page = await context.newPage();

    for (let pageNum = 1; pageNum <= maxPages && parsed.length < perDistrict; pageNum++) {
      const url = idealistaListUrl(zone.citySlug, zone.districtSlug, pageNum);
      if (!url) break;
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await sleep(pauseMs);
      const status = res?.status() ?? 0;
      const html = await page.content();
      if (status === 403 || /datadome|captcha|access denied/i.test(html)) {
        blocked = true;
        break;
      }

      const batch = await page.$$eval("article[data-adid]", (articles) =>
        articles.map((el) => {
          const id = el.getAttribute("data-adid");
          const link = el.querySelector("a[href*='/inmueble/']");
          const href = link?.getAttribute("href") ?? "";
          const text = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
          return { id, href, text };
        })
      );

      if (batch.length === 0) break;

      for (const row of batch) {
        if (!row.id || seen.has(row.id)) continue;
        seen.add(row.id);
        const price = parseEuro(row.text);
        if (price == null) continue;
        const sourceUrl = row.href.startsWith("http")
          ? row.href
          : `https://www.idealista.com${row.href}`;
        parsed.push({
          externalId: row.id,
          title: row.text.slice(0, 200) || `Idealista ${row.id}`,
          price,
          sourceUrl,
        });
        if (parsed.length >= perDistrict) break;
      }
    }

    await browser.close();

    if (blocked && parsed.length === 0) {
      throw new Error(
        "Idealista bloqueó el acceso (403/Datadome). Configura IDEALISTA_PROXY_URL o ejecuta desde IP residencial."
      );
    }

    let inserted = 0;
    const zoneLabel = zone.zoneName ?? zone.districtSlug;
    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i];
      let lon = null;
      let lat = null;
      const cityLabel =
        { madrid: "Madrid", valencia: "Valencia", sevilla: "Sevilla", barcelona: "Barcelona" }[
          zone.citySlug
        ] ?? zone.citySlug;
      const geo = await geocodeSpain(`${zoneLabel}, ${cityLabel}, España`);
      if (geo) {
        lon = geo.lon;
        lat = geo.lat;
      }
      if (lon == null || lat == null) continue;

      const payload = {
        source_portal: PORTAL,
        source_external_id: String(row.externalId),
        operation: "sale",
        title: row.title,
        price: row.price,
        city: zoneLabel,
        ccaa: zone.ccaa ?? null,
        source_url: row.sourceUrl,
        status: "active",
        geocode_quality: 5,
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
      if (i > 0 && i % 5 === 0) await sleep(200);
    }

    await supabase
      .from("scrape_runs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        listings_inserted: inserted,
        error_message: blocked ? "partial: idealista anti-bot on some pages" : null,
      })
      .eq("id", run.id);

    return {
      ok: true,
      portal: PORTAL,
      district: runKey,
      parsed: parsed.length,
      inserted,
      externalIds: [...seen],
      blocked,
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

/** Varias zonas en un run (límite global MAX_LISTINGS). */
export async function runIdealistaDistrictBatch(citySlug, zones) {
  const results = [];
  for (const z of zones) {
    if (results.reduce((s, r) => s + (r.inserted ?? 0), 0) >= maxListings()) break;
    try {
      results.push(
        await runIdealistaDistrictSale({
          citySlug,
          districtSlug: z.pisosDistrict ?? z.slug.split("/").pop(),
          zoneName: z.name,
          ccaa: z.ccaa,
        })
      );
    } catch (e) {
      results.push({
        ok: false,
        district: z.slug,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}
