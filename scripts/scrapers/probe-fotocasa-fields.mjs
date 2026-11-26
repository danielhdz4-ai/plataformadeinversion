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
console.log(Object.keys(obj));
console.log("location", obj.location);
console.log("multimedia", obj.multimedia?.images?.[0]);
console.log("surface", obj.surface, obj.size, obj.features);
