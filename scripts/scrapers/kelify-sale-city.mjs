import { runKelifySale } from "./lib/run-kelify-scrape.mjs";

const citySlug = process.env.CITY_SLUG ?? "madrid";
const result = await runKelifySale(citySlug);
console.log(JSON.stringify(result));
