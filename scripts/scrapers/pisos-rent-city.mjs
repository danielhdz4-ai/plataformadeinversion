import { runPisosRent } from "./lib/run-pisos-scrape.mjs";

const citySlug = process.env.CITY_SLUG ?? "barcelona";
const result = await runPisosRent(citySlug);
console.log(JSON.stringify(result));
