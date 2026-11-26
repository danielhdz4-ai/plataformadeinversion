import { fetchFotocasaListPage } from "./lib/fotocasa-api.mjs";

const { listings, url } = await fetchFotocasaListPage("madrid-capital", 1);
console.log(url, "count", listings.length);
console.log(JSON.stringify(listings.slice(0, 2), null, 2));
