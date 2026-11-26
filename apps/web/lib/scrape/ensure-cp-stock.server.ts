import { isAggressiveCpStock } from "@/lib/map/cp-priority";
import { refreshPostalCodeLive } from "@/lib/scrape/scrape-postal-code.server";
import { portalsForCpLiveImport } from "@/lib/scrape/cp-live-portals";
import {
  shouldOffloadCpScrapeToActions,
  triggerPostalCodeScrapeWorkflow,
} from "@/lib/scrape/trigger-cp-scrape-workflow.server";

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

/**
 * Cuando el stock fresco < objetivo: Actions si hay token; siempre scrape Vercel en background.
 */
export async function ensureCpStockIngest(cp: string, opts?: { forceScrape?: boolean }) {
  const normalized = cp.replace(/\D/g, "").slice(0, 5);
  if (normalized.length !== 5) return { dispatched: false, scrapeStarted: false };

  let dispatched = false;
  if (shouldOffloadCpScrapeToActions()) {
    dispatched = await triggerPostalCodeScrapeWorkflow(normalized);
  }

  const forceScrape = opts?.forceScrape !== false;
  if (!forceScrape && dispatched) {
    return { dispatched, scrapeStarted: false, cp: normalized };
  }

  applyAggressiveScrapeEnv(normalized);
  const portals = portalsForCpLiveImport();
  const scrape = await refreshPostalCodeLive(normalized, { portals, force: true });
  return { dispatched, scrapeStarted: true, cp: normalized, scrape };
}