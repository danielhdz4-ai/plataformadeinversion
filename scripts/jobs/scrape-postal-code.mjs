/**
 * Scrape ventas por código postal (cientos en BD).
 * Uso: node --env-file=.env.local scripts/jobs/scrape-postal-code.mjs 28033 28043
 */
import { scrapeByPostalCode } from "../scrapers/lib/scrape-by-postal-code.mjs";

const codes = process.argv.slice(2).filter(Boolean);
if (codes.length === 0) {
  console.error("Uso: node scripts/jobs/scrape-postal-code.mjs <cp> [cp2 ...]");
  process.exit(1);
}

for (const cp of codes) {
  const result = await scrapeByPostalCode(cp, { force: true });
  console.log(JSON.stringify(result));
}
