const url = "https://www.fotocasa.es/es/comprar/viviendas/madrid-capital/todas-las-zonas/l";
const r = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html",
    "Accept-Language": "es-ES,es;q=0.9",
  },
});
const html = await r.text();

// Extract all propertyId + price + optional lat/lon from inline JSON fragments
const ids = new Set();
const listings = [];
const re =
  /"propertyId"\s*:\s*(\d+)[\s\S]{0,2500}?"price"\s*:\s*(\d+)[\s\S]{0,800}?"latitude"\s*:\s*([\d.-]+)[\s\S]{0,80}?"longitude"\s*:\s*([\d.-]+)/g;
let m;
while ((m = re.exec(html))) {
  const id = m[1];
  if (ids.has(id)) continue;
  ids.add(id);
  listings.push({
    id,
    price: Number(m[2]),
    lat: Number(m[3]),
    lon: Number(m[4]),
  });
}
console.log("regex listings", listings.length);
console.log(listings.slice(0, 3));

const hrefRe = /\/es\/comprar\/vivienda\/[^"']+\/(\d+)\/d/g;
const fromHref = new Set();
let h;
while ((h = hrefRe.exec(html))) fromHref.add(h[1]);
console.log("from href ids", fromHref.size, [...fromHref].slice(0, 5));

// look for API path in html
const apiPaths = [...new Set((html.match(/\/api\/[a-zA-Z0-9/_-]+/g) ?? []))].slice(0, 20);
console.log("api paths", apiPaths);
