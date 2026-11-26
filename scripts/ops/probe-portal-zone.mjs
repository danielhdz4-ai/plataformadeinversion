import { fetchFotocasaListPage } from "../scrapers/lib/fotocasa-api.mjs";

const zone = process.argv[2] ?? "madrid-capital/salamanca";
const { listings, url } = await fetchFotocasaListPage(zone, 1);
console.log(url, listings.length);
