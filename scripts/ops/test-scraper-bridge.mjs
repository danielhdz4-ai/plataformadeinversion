/** Simula apps/web/lib/scrape/load-scraper-module.ts (Windows). */
import { join } from "node:path";
import { pathToFileURL } from "node:url";

function scraperRepoRoot() {
  const cwd = process.cwd();
  if (cwd.replace(/\\/g, "/").endsWith("/apps/web")) {
    return join(cwd, "../..");
  }
  return cwd;
}

async function importScraperModule(relativePath) {
  const modPath = join(scraperRepoRoot(), relativePath);
  return import(pathToFileURL(modPath).href);
}

const cwd = process.argv.includes("--cwd-web")
  ? join(process.cwd(), "apps/web")
  : process.cwd();
process.chdir(cwd);

const mod = await importScraperModule("scripts/scrapers/lib/fotocasa-api.mjs");
const r = await mod.fetchFotocasaListPage("madrid-capital", 1);
console.log(
  JSON.stringify({
    ok: (r.listings?.length ?? 0) > 0,
    cwd: process.cwd(),
    cards: r.listings?.length ?? 0,
  })
);
