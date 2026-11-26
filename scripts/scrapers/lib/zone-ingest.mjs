/**
 * Ingestión on-demand por barrio — objetivo: cientos de ventas en el polígono (España).
 */
import { getSupabase } from "./env.mjs";
import { resolveZonesForPolygon } from "./resolve-zones-for-polygon.mjs";
import { ingestCityWide } from "./ingest-city-wide.mjs";
import { runFotocasaSale } from "./run-fotocasa-scrape.mjs";
import { runPisosSale } from "./run-pisos-scrape.mjs";
import { touchListingsInPolygon } from "./touch-zone-listings.mjs";
import { scrapeByPostalCode } from "./scrape-by-postal-code.mjs";
import { reverseGeocodeSpain } from "./geocode-es.mjs";
import { ALL_SALE_PORTAL_IDS, normalizeIngestPortals, portalEnabled } from "./all-portals.mjs";
import { ingestExtraPortals } from "./ingest-extra-portals.mjs";
import { tagListingsForPostalCode } from "./tag-listings-for-cp.mjs";
import { normalizeScanPolygonInput, polygonGeojsonText, polygonScanBbox } from "./scan-polygon.mjs";

export const RESIDENTIAL_PORTALS = ALL_SALE_PORTAL_IDS;

const TARGET_IN_POLYGON = Number(process.env.SCAN_TARGET_IN_POLYGON ?? "180");
const MAX_BOOST_ROUNDS = Number(process.env.SCAN_ZONE_BOOST_ROUNDS ?? "3");

function portalsFromEnv(explicit) {
  return normalizeIngestPortals(explicit);
}

async function countInPolygon(supabase, geojson) {
  const { data: inPoly } = await supabase.rpc("listings_in_polygon", { geojson });
  return inPoly?.length ?? 0;
}

async function ingestDistricts(resolved, portals, anchor) {
  let upserted = 0;
  let fetched = 0;
  const portalResults = { pisos: [] };

  if (portalEnabled(portals, "fotocasa")) {
    process.env.FOTOCASA_PER_ZONE = process.env.SCAN_FOTOCASA_PER_ZONE ?? "150";
    process.env.FOTOCASA_MAX_PAGES = process.env.SCAN_FOTOCASA_MAX_PAGES ?? "12";
    portalResults.fotocasa = await runFotocasaSale({
      citySlug: "zone-ingest",
      zones: resolved.zones.map((z) => ({
        slug: z.slug,
        name: z.name,
        ccaa: z.ccaa,
        lat: z.lat ?? anchor.lat,
        lng: z.lng ?? anchor.lng,
      })),
    });
    upserted += portalResults.fotocasa?.inserted ?? 0;
    fetched += portalResults.fotocasa?.cards ?? 0;
  }

  if (portalEnabled(portals, "pisos_com")) {
    const pisosPer = Number(process.env.SCAN_PISOS_PER_DISTRICT ?? "130");
    const pisosPages = Number(process.env.SCAN_PISOS_MAX_PAGES ?? "12");
    for (const z of resolved.zones) {
      const pisosCity = z.pisosCitySlug ?? z.citySlug;
      const district = z.pisosDistrict ?? z.slug?.split("/")?.pop();
      if (!pisosCity || !district) continue;
      try {
        const r = await runPisosSale(pisosCity, {
          district,
          maxListings: pisosPer,
          maxPages: pisosPages,
          fallbackLng: anchor.lng,
          fallbackLat: anchor.lat,
        });
        portalResults.pisos.push({ district, ...r });
        upserted += r?.inserted ?? 0;
      } catch (e) {
        portalResults.pisos.push({
          district,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return { upserted, fetched, portalResults };
}

export async function ingestZoneForPolygon(polygon, options = {}) {
  if (process.env.VERCEL === "1") {
    process.env.SCAN_CP_SKIP_PLAYWRIGHT = "1";
  }
  const supabase = getSupabase();
  const ingestStartedAt = new Date();
  const startedIso = ingestStartedAt.toISOString();
  const polygonNorm = normalizeScanPolygonInput(polygon);
  if (!polygonNorm) {
    return { ok: false, error: "Polígono de scan inválido" };
  }
  const geojson = polygonGeojsonText(polygonNorm);
  const scanBbox = polygonScanBbox(polygonNorm, 2);
  const portals = portalsFromEnv(options.portals);
  const resolved = resolveZonesForPolygon(polygonNorm, options);
  const anchor = resolved.center;
  const cityZone = resolved.anchorCity ?? resolved.zones[0] ?? null;
  const zoneSlugs = resolved.zones.map((z) => z.slug).filter(Boolean);

  const { data: runRow } = await supabase
    .from("zone_ingest_runs")
    .insert({
      scan_id: options.scanId ?? null,
      zone_slugs: zoneSlugs.length ? zoneSlugs : cityZone ? [cityZone.slug] : [],
      status: "running",
      portals,
      meta: { mode: resolved.mode, center: anchor, city: cityZone?.citySlug },
    })
    .select("id")
    .single();

  const ingestRunId = runRow?.id;
  let upserted = 0;
  let fetched = 0;
  const portalResults = {};

  try {
    if (!cityZone) {
      throw new Error("No se pudo resolver ciudad para este punto en España");
    }

    let postalCode = options.postalCode ?? process.env.SCAN_POSTAL_CODE ?? null;
    if (!postalCode) {
      const rev = await reverseGeocodeSpain(anchor.lat, anchor.lng);
      postalCode = rev?.postalCode ?? null;
    }
    if (postalCode) {
      try {
        portalResults.postalCode = await scrapeByPostalCode(postalCode, {
          force: true,
          portals,
        });
        upserted += portalResults.postalCode?.fotocasa?.inserted ?? 0;
        upserted += portalResults.postalCode?.pisos?.inserted ?? 0;
        upserted += portalResults.postalCode?.extra?.upserted ?? 0;
        portalResults.postalTag = await tagListingsForPostalCode(postalCode, {
          center: resolved.center,
        });
      } catch (e) {
        portalResults.postalCode = {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }

    if (resolved.mode === "districts" && resolved.zones.length > 0) {
      const d = await ingestDistricts(resolved, portals, anchor);
      upserted += d.upserted;
      fetched += d.fetched;
      Object.assign(portalResults, d.portalResults);
    }

    const cityBoost = await ingestCityWide(cityZone, anchor, portals, portalEnabled, { scanBbox });
    upserted += cityBoost.upserted;
    portalResults.cityWide = cityBoost;

    let inPolygonAfter = await countInPolygon(supabase, geojson);
    let boostRound = 0;
    while (inPolygonAfter < TARGET_IN_POLYGON && boostRound < MAX_BOOST_ROUNDS) {
      boostRound++;
      process.env.SCAN_CITY_PISOS_MAX = String(650 + boostRound * 200);
      process.env.SCAN_CITY_PISOS_PAGES = String(36 + boostRound * 8);
      const extra = await ingestCityWide(cityZone, anchor, portals, portalEnabled, { scanBbox });
      upserted += extra.upserted;
      portalResults[`cityBoost${boostRound}`] = extra;
      inPolygonAfter = await countInPolygon(supabase, geojson);
    }

    const extra = await ingestExtraPortals({
      portals,
      cityZone,
      resolved,
      postalCode,
      anchor,
    });
    portalResults.extra = extra;
    upserted += extra.upserted ?? 0;
    inPolygonAfter = await countInPolygon(supabase, geojson);

    await touchListingsInPolygon(geojson, zoneSlugs.length ? zoneSlugs : [cityZone.slug], startedIso);

    let archived = null;
    let archErr = null;
    const safeToArchive = upserted >= 8 && inPolygonAfter >= 25;
    if (safeToArchive) {
      const arch = await supabase.rpc("archive_stale_listings_in_polygon", {
        p_geojson: geojson,
        p_ingest_started_at: startedIso,
      });
      archived = arch.data;
      archErr = arch.error;
      if (archErr) console.warn("archive_stale", archErr.message);
    } else {
      portalResults.archiveSkipped = { reason: "weak_ingest", upserted, inPolygonAfter };
    }

    inPolygonAfter = await countInPolygon(supabase, geojson);

    if (ingestRunId) {
      await supabase
        .from("zone_ingest_runs")
        .update({
          status: inPolygonAfter >= TARGET_IN_POLYGON ? "completed" : "partial",
          finished_at: new Date().toISOString(),
          listings_fetched: fetched,
          listings_upserted: upserted,
          in_polygon_after: inPolygonAfter,
          meta: {
            mode: resolved.mode,
            target: TARGET_IN_POLYGON,
            city: cityZone.citySlug,
            portals: portalResults,
            archived: archErr ? null : archived,
          },
        })
        .eq("id", ingestRunId);
    }

    return {
      ok: true,
      mode: resolved.mode,
      city: cityZone.citySlug,
      zones: zoneSlugs,
      upserted,
      fetched,
      inPolygonAfter,
      target: TARGET_IN_POLYGON,
      meetsTarget: inPolygonAfter >= TARGET_IN_POLYGON,
      portals: portalResults,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (ingestRunId) {
      await supabase
        .from("zone_ingest_runs")
        .update({ status: "failed", finished_at: new Date().toISOString(), error_message: msg })
        .eq("id", ingestRunId);
    }
    return { ok: false, error: msg, city: cityZone?.citySlug };
  }
}
