/**
 * Ingestión venta multi-portal por ciudad (pisos + Fotocasa + Hipoges/Solvia/Kelify…).
 * Usado en rotación Tier 2 y jobs on-demand.
 */
import { ALL_SALE_PORTAL_IDS, normalizeIngestPortals, portalEnabled } from "./all-portals.mjs";
import { ingestExtraPortals } from "./ingest-extra-portals.mjs";
import { fotocasaZoneMeta, resolveFotocasaZoneSlug } from "./resolve-fotocasa-zone.mjs";
import { runFotocasaSale } from "./run-fotocasa-scrape.mjs";
import { runPisosSale } from "./run-pisos-scrape.mjs";
import { getCityConfig } from "./spain-city.mjs";
import { resolveNearestCity } from "./resolve-nearest-city.mjs";

export async function runCitySaleIngest(citySlug, options = {}) {
  const city = getCityConfig(citySlug);
  const [minLng, minLat, maxLng, maxLat] = city.bbox;
  const anchor = {
    lng: (minLng + maxLng) / 2,
    lat: (minLat + maxLat) / 2,
  };
  const portals = normalizeIngestPortals(options.portals ?? ALL_SALE_PORTAL_IDS);
  const maxListings = Number(options.maxListings ?? process.env.MAX_LISTINGS ?? "400");
  const maxPages = Number(options.maxPages ?? process.env.PISOS_MAX_PAGES ?? "22");

  const out = { city: citySlug, portals, ok: true };

  if (!city.pisosSkip && portalEnabled(portals, "pisos_com")) {
    try {
      out.pisos = await runPisosSale(citySlug, { maxListings, maxPages });
    } catch (e) {
      out.pisos = { ok: false, error: e instanceof Error ? e.message : String(e) };
      out.ok = false;
    }
  }

  if (portalEnabled(portals, "fotocasa")) {
    const meta = fotocasaZoneMeta(citySlug);
    const slug = meta?.slug ?? resolveFotocasaZoneSlug(citySlug);
    if (slug) {
      process.env.FOTOCASA_PER_ZONE = String(options.fotocasaPerZone ?? process.env.FOTOCASA_PER_ZONE ?? "220");
      process.env.FOTOCASA_MAX_PAGES = String(options.fotocasaPages ?? process.env.FOTOCASA_MAX_PAGES ?? "14");
      try {
        out.fotocasa = await runFotocasaSale({
          citySlug: `city-${citySlug}`,
          cityBbox: city.bbox,
          zones: [
            {
              slug,
              name: meta?.name ?? city.name,
              ccaa: meta?.ccaa ?? city.ccaa,
              lat: meta?.lat ?? anchor.lat,
              lng: meta?.lng ?? anchor.lng,
            },
          ],
        });
      } catch (e) {
        out.fotocasa = { ok: false, error: e instanceof Error ? e.message : String(e), slug };
        out.ok = false;
      }
    } else {
      out.fotocasa = { ok: false, error: "no_fotocasa_slug" };
    }
  }

  const cityZone =
    resolveNearestCity(anchor.lat, anchor.lng, 120) ?? {
      citySlug: city.slug,
      slug: resolveFotocasaZoneSlug(city.slug) ?? city.slug,
      name: city.name,
      ccaa: city.ccaa,
      lat: anchor.lat,
      lng: anchor.lng,
    };

  if (process.env.SCAN_CP_SKIP_PLAYWRIGHT === "1") {
    process.env.SCAN_ZONE_KELIFY = "0";
    process.env.SCAN_IDEALISTA = "0";
  }

  try {
    out.extra = await ingestExtraPortals({
      portals,
      cityZone,
      resolved: { zones: [] },
      postalCode: null,
      anchor,
    });
  } catch (e) {
    out.extra = { ok: false, error: e instanceof Error ? e.message : String(e) };
    out.ok = false;
  }

  out.upserted =
    (out.pisos?.inserted ?? 0) +
    (out.fotocasa?.inserted ?? 0) +
    (out.extra?.upserted ?? out.extra?.inserted ?? 0);

  return out;
}
