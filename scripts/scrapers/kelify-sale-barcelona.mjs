import { runKelifySale } from "./lib/run-kelify-scrape.mjs";

const result = await runKelifySale(process.env.CITY_SLUG ?? "barcelona");
console.log(JSON.stringify(result));
