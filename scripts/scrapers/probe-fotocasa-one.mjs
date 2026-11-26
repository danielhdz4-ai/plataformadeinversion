import { fetchFotocasaListPage } from "./lib/fotocasa-api.mjs";

const { html } = await fetchFotocasaListPage("madrid-capital", 1);
const marker = '"propertyId":';
const i = html.indexOf(marker);
let start = i;
while (start > 0 && html[start] !== "{") start--;
let depth = 0;
let end = start;
for (; end < html.length; end++) {
  if (html[end] === "{") depth++;
  else if (html[end] === "}") {
    depth--;
    if (depth === 0) {
      end++;
      break;
    }
  }
}
const obj = JSON.parse(html.slice(start, end));
console.log("address", obj.address);
console.log("locationCardView", obj.locationCardView);
console.log("multimedia keys", obj.multimedia ? Object.keys(obj.multimedia) : null);
console.log("multimedia sample", JSON.stringify(obj.multimedia).slice(0, 400));
