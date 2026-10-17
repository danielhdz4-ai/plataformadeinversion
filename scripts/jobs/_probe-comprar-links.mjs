const slug = process.argv[2] ?? "a-coruna";
const html = await (await fetch(`https://www.pisos.com/venta/pisos-${slug}/`)).text();
const links = [...html.matchAll(/href="(\/comprar\/[^"]+)"/g)]
  .map((m) => m[1])
  .filter((u, i, a) => a.indexOf(u) === i)
  .slice(0, 8);
console.log("links", links.length, links.slice(0, 3));

import { parsePisosListingsFromHtml } from "../scrapers/lib/parse-pisos-ld.mjs";

for (const path of links.slice(0, 3)) {
  const url = `https://www.pisos.com${path}`;
  const h = await (await fetch(url)).text();
  const p = parsePisosListingsFromHtml(h, { max: 1, bbox: [-25, 27, 5, 44] });
  console.log(path.slice(0, 60), p[0] ? { lat: p[0].lat, lon: p[0].lon, city: p[0].city } : "no ld");
}
