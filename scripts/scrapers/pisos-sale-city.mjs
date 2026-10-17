import { runPisosSale } from "./lib/run-pisos-scrape.mjs";

const citySlug = process.env.CITY_SLUG ?? "barcelona";
const result = await runPisosSale(citySlug);
console.log(JSON.stringify(result));
