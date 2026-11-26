/**
 * Batch CP desde scripts/jobs/data/postal-codes-scrape.json
 * node --env-file=.env.local scripts/jobs/scrape-postal-codes-batch.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scrapeByPostalCode } from "../scrapers/lib/scrape-by-postal-code.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const cfg = JSON.parse(
  readFileSync(join(root, "scripts/jobs/data/postal-codes-scrape.json"), "utf8")
);
const codes = cfg.postalCodes ?? [];

for (const cp of codes) {
  const result = await scrapeByPostalCode(cp, { force: true });
  console.log(JSON.stringify(result));
}
