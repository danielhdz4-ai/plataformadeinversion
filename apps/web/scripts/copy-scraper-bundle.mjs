import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");
const dest = join(here, "../lib/scraper-runtime");

rmSync(dest, { recursive: true, force: true });
mkdirSync(join(dest, "scrapers", "lib"), { recursive: true });
mkdirSync(join(dest, "scrape"), { recursive: true });
cpSync(join(repoRoot, "scripts/scrapers/lib"), join(dest, "scrapers/lib"), { recursive: true });
cpSync(join(repoRoot, "scripts/scrape"), join(dest, "scrape"), { recursive: true });
console.log("scraper runtime copied to", dest);
