import { HABITACLIA_SALE_ZONES } from "./habitaclia-zones.mjs";
import { runHipogesSale } from "./run-hipoges-scrape.mjs";
import { runSolviaSale } from "./run-solvia-scrape.mjs";
import { portalEnabled } from "./all-portals.mjs";

const CITY_HABITACLIA = {
  madrid: "Madrid",
  barcelona: "Barcelona",
  valencia: "Valencia",
  sevilla: "Sevilla",
  malaga: "Málaga",
  bilbao: "Bilbao",
  zaragoza: "Zaragoza",
  alicante: "Alicante",
};

function habitacliaZonesForCity(citySlug) {
  const label = CITY_HABITACLIA[citySlug];
  if (!label) return [];
  return HABITACLIA_SALE_ZONES.filter((z) => z.name === label);
}

function sumInserted(block) {
  if (!block) return 0;
  if (typeof block.inserted === "number") return block.inserted;
  if (Array.isArray(block)) return block.reduce((n, x) => n + (x?.inserted ?? 0), 0);
  return 0;
}

/** Hipoges, Solvia, habitaclia, Kelify, Idealista (según toggles del scan). */
export async function ingestExtraPortals(ctx) {
  const { portals, cityZone, resolved, postalCode, anchor } = ctx;
  const out = {};
  let upserted = 0;
  const citySlug = cityZone?.citySlug;
  const skipPlaywright = process.env.SCAN_CP_SKIP_PLAYWRIGHT === "1";

  if (portalEnabled(portals, "habitaclia") && !skipPlaywright) {
    const zones = habitacliaZonesForCity(citySlug);
    if (zones.length) {
      process.env.HABITACLIA_PER_ZONE = process.env.SCAN_HABITACLIA_PER_ZONE ?? "150";
      process.env.HABITACLIA_MAX_PAGES = process.env.SCAN_HABITACLIA_PAGES ?? "10";
      try {
        const { runHabitacliaSale } = await import("./run-habitaclia-scrape.mjs");
        out.habitaclia = await runHabitacliaSale({
          citySlug: `cp-${citySlug}`,
          zones,
          postalCodeTarget: postalCode ?? null,
          anchor: postalCode ? anchor : null,
        });
        upserted += out.habitaclia?.inserted ?? 0;
      } catch (e) {
        out.habitaclia = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  }

  if (portalEnabled(portals, "hipoges")) {
    try {
      out.hipoges = await runHipogesSale({
        postalCodeTarget: postalCode ?? null,
        anchor: postalCode ? anchor : null,
        maxPages: postalCode
          ? Number(process.env.SCAN_HIPOGES_MAX_PAGES ?? "25")
          : Number(process.env.SCAN_HIPOGES_LIGHT_PAGES ?? "6"),
      });
      upserted += out.hipoges?.inserted ?? 0;
    } catch (e) {
      out.hipoges = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  if (portalEnabled(portals, "solvia")) {
    try {
      out.solvia = await runSolviaSale({
        postalCodeTarget: postalCode ?? null,
        anchor: postalCode ? anchor : null,
        maxPages: postalCode
          ? Number(process.env.SCAN_SOLVIA_MAX_PAGES ?? "12")
          : Number(process.env.SCAN_SOLVIA_LIGHT_PAGES ?? "4"),
      });
      upserted += out.solvia?.inserted ?? 0;
    } catch (e) {
      out.solvia = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  if (
    citySlug &&
    portalEnabled(portals, "kelify") &&
    process.env.SCAN_ZONE_KELIFY !== "0" &&
    !skipPlaywright
  ) {
    process.env.MAX_LISTINGS = process.env.SCAN_KELIFY_MAX ?? "180";
    try {
      const { runKelifySale } = await import("./run-kelify-scrape.mjs");
      out.kelify = await runKelifySale(citySlug, {
        postalCodeTarget: postalCode ?? null,
        anchor: postalCode ? anchor : null,
      });
      upserted += out.kelify?.inserted ?? 0;
    } catch (e) {
      out.kelify = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  if (
    portalEnabled(portals, "idealista") &&
    process.env.SCAN_IDEALISTA !== "0" &&
    citySlug &&
    !skipPlaywright
  ) {
    out.idealista = [];
    const { runIdealistaDistrictSale } = await import("./run-idealista-scrape.mjs");
    const districts = (resolved?.zones ?? []).slice(0, 5);
    for (const z of districts) {
      const district = z.pisosDistrict ?? z.slug?.split("/")?.pop();
      if (!district) continue;
      try {
        const r = await runIdealistaDistrictSale({
          citySlug,
          districtSlug: district,
          zoneName: z.name,
          ccaa: z.ccaa,
          postalCodeTarget: postalCode ?? null,
          anchor: postalCode ? anchor : null,
        });
        out.idealista.push({ district, ...r });
        upserted += r?.inserted ?? 0;
      } catch (e) {
        out.idealista.push({
          district,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return { ...out, upserted, inserted: upserted };
}

export { sumInserted };
