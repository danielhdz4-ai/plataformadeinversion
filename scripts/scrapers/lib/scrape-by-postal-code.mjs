/**
 * Objetivo: cientos de ventas activas por CP en Supabase (todos los portales activos).
 */
import { getSupabase } from "./env.mjs";
import { resolveZonesForPostalCode } from "./resolve-zones-for-postal-code.mjs";
import { fetchFotocasaListPage } from "./fotocasa-api.mjs";
import { runPisosSale } from "./run-pisos-scrape.mjs";
import { geocodeSpain } from "./geocode-es.mjs";
import { dryRun } from "./env.mjs";
import { normalizeIngestPortals } from "./all-portals.mjs";
import { ingestExtraPortals } from "./ingest-extra-portals.mjs";
import { tagListingsForPostalCode } from "./tag-listings-for-cp.mjs";
import { runPisosRent } from "./run-pisos-scrape.mjs";

import { haversineKm } from "./geo.mjs";

const PORTAL = "fotocasa";
const TARGET = Number(process.env.SCRAPE_TARGET_PER_CP ?? "120");
/** Rural: acepta anuncios geolocalizados a ≤ N km del centro del CP. */
const NEARBY_KM = Number(process.env.SCRAPE_CP_NEARBY_KM ?? "12");
const NEARBY_CAP = Number(process.env.SCRAPE_CP_NEARBY_MAX ?? "30");
const RURAL_CP = new Set([
  "05267", "39680", "18411", "21200", "25126", "42146", "09560", "15886", "15300",
  "40542", "50630", "24540", "47460", "09340", "44240",
]);
const GAP_CP = new Set(["01001", "20001", "26001", "31001", "21001"]);
const MIN_PER_PORTAL = Number(process.env.SCRAPE_CP_MIN_PER_PORTAL ?? "15");
const MAX_BOOST = Number(process.env.SCRAPE_CP_BOOST_ROUNDS ?? "3");

function normalizeCp(v) {
  const s = String(v ?? "").replace(/\D/g, "").slice(0, 5);
  return s.length === 5 ? s : null;
}

function cpMatches(listingCp, targetCp) {
  const a = normalizeCp(listingCp);
  const b = normalizeCp(targetCp);
  return a != null && b != null && a === b;
}

async function countActiveByCp(supabase, postalCode) {
  const { count, error } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .eq("operation", "sale")
    .eq("postal_code", postalCode);
  if (error) throw error;
  return count ?? 0;
}

/** Alquileres activos con `last_seen_at` reciente en la ciudad (por `city` LIKE). */
async function countFreshRentForCity(supabase, citySlug, maxAgeDays) {
  if (!citySlug) return 0;
  const { getCityConfig } = await import("./spain-city.mjs");
  const city = getCityConfig(citySlug);
  const needle = (city?.regionPattern ?? city?.name ?? citySlug).replace(/[%_]/g, "");
  const since = new Date(Date.now() - maxAgeDays * 864e5).toISOString();
  const { count, error } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .eq("operation", "rent")
    .gte("last_seen_at", since)
    .ilike("city", `%${needle.split(",")[0]}%`);
  if (error) return 0;
  return count ?? 0;
}

async function countByCpPortal(supabase, postalCode) {  const { data, error } = await supabase
    .from("listings")
    .select("source_portal")
    .eq("status", "active")
    .eq("operation", "sale")
    .eq("postal_code", postalCode);
  if (error) throw error;
  const out = {};
  for (const row of data ?? []) {
    const p = row.source_portal ?? "unknown";
    out[p] = (out[p] ?? 0) + 1;
  }
  return out;
}

function needsMoreScrape(total, byPortal, portals, target, minPerPortal) {
  if (total < target) return true;
  for (const p of portals) {
    if (p === "idealista") continue;
    if ((byPortal[p] ?? 0) < minPerPortal) return true;
  }
  return false;
}

function isRuralCp(cp) {
  return RURAL_CP.has(cp) || GAP_CP.has(cp);
}

async function upsertFotocasaListing(supabase, mapped, zone, anchor, postalCode, stats) {
  if (!mapped.externalId || mapped.price == null) return false;
  let nearRural = false;
  if (!cpMatches(mapped.postalCode, postalCode)) {
    if (!isRuralCp(postalCode) || mapped.lat == null || mapped.lon == null || !anchor) {
      if (stats) stats.skipCp++;
      return false;
    }
    const km = haversineKm(anchor.lat, anchor.lng, mapped.lat, mapped.lon);
    if (km > NEARBY_KM || (stats?.nearby ?? 0) >= NEARBY_CAP) {
      if (stats) stats.skipCp++;
      return false;
    }
    nearRural = true;
  }

  let lon = mapped.lon;
  let lat = mapped.lat;
  let geocodeQuality = lon != null && lat != null ? 3 : 4;
  if ((lon == null || lat == null) && anchor) {
    lon = anchor.lng;
    lat = anchor.lat;
    geocodeQuality = 5;
  } else if (lon == null || lat == null) {
    const geo = await geocodeSpain(`${postalCode}, ${zone.name ?? ""}, España`);
    if (geo) {
      lon = geo.lon;
      lat = geo.lat;
      geocodeQuality = 5;
    }
  }
  if (lon == null || lat == null) return false;

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
    postal_code: postalCode,
    source_url: mapped.sourceUrl,
    thumbnail_url: mapped.thumbnail,
    status: "active",
    geocode_quality: geocodeQuality,
    scraped_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  };

  if (dryRun()) {
    if (nearRural && stats) stats.nearby++;
    return true;
  }

  const { data: upserted, error } = await supabase
    .from("listings")
    .upsert(payload, { onConflict: "source_portal,source_external_id" })
    .select("id")
    .maybeSingle();
  if (error || !upserted?.id) {
    if (stats) stats.upsertErr++;
    return false;
  }
  await supabase.rpc("patch_listing_geom", { listing_id: upserted.id, lon, lat });
  if (nearRural && stats) stats.nearby++;
  return true;
}

async function scrapeFotocasaForCp(supabase, resolved, postalCode, stats) {
  const maxPages = Number(process.env.SCRAPE_CP_FOTOCASA_PAGES ?? "24");
  const anchor = resolved.center;
  let inserted = 0;
  let cards = 0;

  for (const zone of resolved.fotocasaZones) {
    let empty = 0;
    for (let page = 1; page <= maxPages; page++) {
      const inDb = await countActiveByCp(supabase, postalCode);
      if (inDb >= TARGET) break;

      let listings = [];
      try {
        ({ listings } = await fetchFotocasaListPage(zone.slug, page));
      } catch (e) {
        console.warn("fotocasa cp page", zone.slug, page, e instanceof Error ? e.message : e);
        break;
      }
      if (listings.length === 0) {
        empty++;
        if (empty >= 2) break;
        continue;
      }
      empty = 0;
      cards += listings.length;

      for (const mapped of listings) {
        if (await upsertFotocasaListing(supabase, mapped, zone, anchor, postalCode, stats)) {
          inserted++;
        }
      }
    }
    const inDb = await countActiveByCp(supabase, postalCode);
    if (inDb >= TARGET) break;
  }

  return { inserted, cards };
}

async function scrapePisosForCp(resolved, postalCode) {
  const citySlug = resolved.anchorCity?.citySlug;
  if (!citySlug) return { inserted: 0, ok: false, reason: "no_city" };

  const maxListings = Number(process.env.SCRAPE_CP_PISOS_MAX ?? "400");
  const maxPages = Number(process.env.SCRAPE_CP_PISOS_PAGES ?? "28");
  const anchor = resolved.center;
  let inserted = 0;
  const districts = resolved.zones.filter((z) => z.pisosDistrict || z.slug?.includes("/"));
  const targets =
    districts.length > 0
      ? districts
      : [{ pisosDistrict: null, slug: resolved.anchorCity.slug }];

  for (const z of targets) {
    const district = z.pisosDistrict ?? z.slug?.split("/")?.pop() ?? null;
    try {
      const r = await runPisosSale(citySlug, {
        district,
        maxListings,
        maxPages,
        fallbackLng: anchor.lng,
        fallbackLat: anchor.lat,
        postalCodeTarget: postalCode,
      });
      inserted += r?.inserted ?? 0;
    } catch (e) {
      console.warn("pisos cp", district, e instanceof Error ? e.message : e);
    }
    const supabase = getSupabase();
    const inDb = await countActiveByCp(supabase, postalCode);
    if (inDb >= TARGET) break;
  }

  return { inserted };
}

function boostEnvForCp(cp) {
  if (!RURAL_CP.has(cp) && !GAP_CP.has(cp)) return;
  process.env.SCAN_CP_DISTRICT_KM ??= "22";
  process.env.SCAN_CP_MAX_DISTRICTS ??= "14";
  process.env.SCRAPE_CP_TAG_RADIUS_M ??= "7500";
  process.env.SCRAPE_CP_FOTOCASA_PAGES ??= "50";
  process.env.SCRAPE_CP_PISOS_PAGES ??= "24";
  process.env.SCRAPE_CP_PISOS_MAX ??= "500";
  process.env.SCRAPE_CP_BOOST_ROUNDS = String(
    Math.max(Number(process.env.SCRAPE_CP_BOOST_ROUNDS ?? "3"), 5)
  );
}

async function tagCpWide(cp, center) {
  const base = RURAL_CP.has(cp) || GAP_CP.has(cp) ? 5500 : 2800;
  const steps = [
    base,
    Math.min(15_000, Math.round(base * 1.35)),
    Math.min(15_000, Math.round(base * 1.75)),
    15_000,
  ].filter((v, i, a) => a.indexOf(v) === i);
  let tagged = 0;
  const details = [];
  for (const radiusM of steps) {
    const r = await tagListingsForPostalCode(cp, { center, radiusM });
    details.push({ radiusM, ...r });
    if (r.ok) tagged += Number(r.tagged ?? 0);
    if (Number(r.tagged ?? 0) === 0 && radiusM >= 12_000) break;
  }
  return { tagged, steps: details };
}

export async function scrapeByPostalCode(postalCode, options = {}) {
  const cp = normalizeCp(postalCode);
  if (!cp) throw new Error(`CP inválido: ${postalCode}`);

  boostEnvForCp(cp);
  const supabase = getSupabase();
  const target = Number(options.target ?? TARGET);
  const before = await countActiveByCp(supabase, cp);
  if (before >= target && !options.force) {
    return { ok: true, postalCode: cp, skipped: true, countBefore: before, countAfter: before, target };
  }

  process.env.SCAN_CP_SKIP_PLAYWRIGHT = "1";
  if (!process.env.SCAN_HIPOGES_MAX_PAGES) process.env.SCAN_HIPOGES_MAX_PAGES = "10";
  if (!process.env.SCAN_SOLVIA_MAX_PAGES) process.env.SCAN_SOLVIA_MAX_PAGES = "6";
  const portals = normalizeIngestPortals(options.portals);
  const resolved = await resolveZonesForPostalCode(cp);
  const stats = { skipCp: 0, nearby: 0, upsertErr: 0 };
  let fotocasa = { inserted: 0, cards: 0 };
  try {
    fotocasa = await scrapeFotocasaForCp(supabase, resolved, cp, stats);
  } catch (e) {
    fotocasa = {
      inserted: 0,
      cards: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
  const pisos = await scrapePisosForCp(resolved, cp);
  let extra = await ingestExtraPortals({
    portals,
    cityZone: resolved.anchorCity,
    resolved,
    postalCode: cp,
    anchor: resolved.center,
  });

  let boost = 0;
  const rural = isRuralCp(cp);
  const boostMax = rural ? Math.max(MAX_BOOST, 6) : MAX_BOOST;
  while (boost < boostMax) {
    const inDb = await countActiveByCp(supabase, cp);
    const byPortal = await countByCpPortal(supabase, cp);
    if (!needsMoreScrape(inDb, byPortal, portals, target, MIN_PER_PORTAL)) break;
    boost++;
    process.env.SCRAPE_CP_PISOS_MAX = String(450 + boost * 150);
    process.env.SCRAPE_CP_FOTOCASA_PAGES = rural
      ? String(40 + boost * 12)
      : String(28 + boost * 8);
    process.env.SCAN_HIPOGES_MAX_PAGES = String(20 + boost * 6);
    process.env.SCAN_SOLVIA_MAX_PAGES = String(10 + boost * 4);
    await scrapeFotocasaForCp(supabase, resolved, cp, stats);
    await scrapePisosForCp(resolved, cp);
    extra = await ingestExtraPortals({
      portals,
      cityZone: resolved.anchorCity,
      resolved,
      postalCode: cp,
      anchor: resolved.center,
    });
  }

  const tagged =
    RURAL_CP.has(cp) || GAP_CP.has(cp)
      ? await tagCpWide(cp, resolved.center)
      : await tagListingsForPostalCode(cp, { center: resolved.center });

  // Comparables de alquiler: sin ellos el ROI cae a benchmark/heurístico.
  let rent = null;
  const rentDays = Number(process.env.SCRAPE_CP_RENT_MAX_AGE_DAYS ?? "45");
  try {
    const fresh = await countFreshRentForCity(supabase, resolved.anchorCity?.citySlug, rentDays);
    const minFresh = Number(process.env.SCRAPE_CP_RENT_MIN_FRESH ?? "40");
    if (fresh < minFresh) {
      const r = await runPisosRent(resolved.anchorCity.citySlug);
      rent = { refreshed: true, inserted: r.inserted ?? 0, freshBefore: fresh };
    } else {
      rent = { refreshed: false, freshBefore: fresh };
    }
  } catch (e) {
    rent = { refreshed: false, error: e instanceof Error ? e.message : String(e) };
  }

  let roi = { candidates: 0, updated: 0 };
  try {
    const { ensureFreshRoi } = await import("./ensure-fresh-roi.mjs");
    roi = await ensureFreshRoi(cp);
  } catch (e) {
    roi = { candidates: 0, updated: 0, error: e instanceof Error ? e.message : String(e) };
  }

  const countAfter = await countActiveByCp(supabase, cp);
  const byPortalAfter = await countByCpPortal(supabase, cp);

  return {
    ok: true,
    postalCode: cp,
    countBefore: before,
    countAfter,
    byPortal: byPortalAfter,
    target,
    minPerPortal: MIN_PER_PORTAL,
    meetsTarget:
      countAfter >= target &&
      portals.every(
        (p) => p === "idealista" || (byPortalAfter[p] ?? 0) >= MIN_PER_PORTAL
      ),
    districts: resolved.zones.map((z) => z.slug),
    portals,
    fotocasa,
    pisos,
    extra,
    tagged,
    rent,
    roi,
    nearby: { applied: rural, radiusKm: NEARBY_KM, cap: NEARBY_CAP, ...stats },
    boostRounds: boost,
  };
}
