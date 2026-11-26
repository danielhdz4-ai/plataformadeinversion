import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const bundleRoot = join(here, "../lib/scraper-runtime");
const cp = process.argv[2];
if (!cp) {
  console.log(JSON.stringify({ ok: false, error: "missing cp" }));
  process.exit(1);
}

process.env.SCAN_CP_SKIP_PLAYWRIGHT = "1";

const mod = await import(
  pathToFileURL(join(bundleRoot, "scrapers/lib/scrape-by-postal-code.mjs")).href
);

try {
  const result = await mod.scrapeByPostalCode(cp, { force: true });
  console.log(JSON.stringify(result));
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
}
