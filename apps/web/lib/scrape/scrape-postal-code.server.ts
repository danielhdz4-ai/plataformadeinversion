import { isAggressiveCpStock } from "@/lib/map/cp-priority";
import { importScraperModule } from "@/lib/scrape/load-scraper-module";
import { createClient } from "@supabase/supabase-js";

function applyAggressiveScrapeEnv(cp: string) {
  if (!isAggressiveCpStock(cp)) return;
  process.env.SCAN_CP_DISTRICT_KM ??= "22";
  process.env.SCAN_CP_MAX_DISTRICTS ??= "14";
  process.env.SCRAPE_CP_TAG_RADIUS_M ??= "7500";
  process.env.SCRAPE_CP_FOTOCASA_PAGES ??= "32";
  process.env.SCRAPE_CP_PISOS_PAGES ??= "24";
  process.env.SCRAPE_CP_PISOS_MAX ??= "500";
  process.env.SCRAPE_CP_BOOST_ROUNDS ??= "5";
  process.env.SCAN_HIPOGES_MAX_PAGES ??= "18";
  process.env.SCAN_SOLVIA_MAX_PAGES ??= "12";
}

export type PostalCodeScrapeResult = {
  ok?: boolean;
  postalCode?: string;
  countAfter?: number;
  byPortal?: Record<string, number>;
  meetsTarget?: boolean;
  target?: number;
  error?: string;
  skipped?: boolean;
};

/** Importación en vivo (Fotocasa, pisos.com, resto portales) — cualquier CP España. */
export async function refreshPostalCodeLive(
  postalCode: string,
  options?: { portals?: string[]; force?: boolean }
): Promise<PostalCodeScrapeResult> {
  if (process.env.SCAN_PREFETCH_ENABLED === "0") {
    return { skipped: true, error: "disabled" };
  }

  if (process.env.VERCEL === "1") {
    process.env.SCAN_CP_SKIP_PLAYWRIGHT = "1";
    process.env.SCRAPE_CP_FOTOCASA_PAGES ??= "16";
    process.env.SCRAPE_CP_PISOS_PAGES ??= "12";
    process.env.SCRAPE_CP_PISOS_MAX ??= "220";
    process.env.SCRAPE_CP_BOOST_ROUNDS ??= "3";
    process.env.SCAN_HIPOGES_MAX_PAGES ??= "10";
    process.env.SCAN_SOLVIA_MAX_PAGES ??= "6";
    globalThis.__PI_CREATE_SUPABASE__ = (url: string, key: string) => createClient(url, key);
  }

  applyAggressiveScrapeEnv(postalCode.replace(/\D/g, "").slice(0, 5));

  try {
    const mod = await importScraperModule<{
      scrapeByPostalCode: (
        cp: string,
        o: { portals?: string[]; force?: boolean }
      ) => Promise<PostalCodeScrapeResult & { byPortal?: Record<string, number> }>;
    }>("scripts/scrapers/lib/scrape-by-postal-code.mjs");
    return await mod.scrapeByPostalCode(postalCode, {
      portals: options?.portals,
      force: options?.force ?? true,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
