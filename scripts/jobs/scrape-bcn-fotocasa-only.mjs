import { listBcnFotocasaZones } from "../scrapers/lib/bcn-metro.mjs";
import { runFotocasaSale } from "../scrapers/lib/run-fotocasa-scrape.mjs";

process.env.FOTOCASA_PER_ZONE = process.env.FOTOCASA_PER_ZONE ?? "200";
process.env.FOTOCASA_MAX_PAGES = process.env.FOTOCASA_MAX_PAGES ?? "15";
process.env.MAX_LISTINGS = process.env.MAX_LISTINGS ?? "5000";
process.env.PAUSE_MS = process.env.PAUSE_MS ?? "650";

const r = await runFotocasaSale({
  zones: listBcnFotocasaZones(),
  citySlug: "bcn-metro",
});
console.log(JSON.stringify(r, null, 2));
