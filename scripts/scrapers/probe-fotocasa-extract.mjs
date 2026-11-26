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

const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
for (const m of ld) {
  const j = JSON.parse(m[1]);
  console.log("LD full keys", typeof j, j["@type"]);
  if (j["@type"] === "ItemList") {
    console.log("items", j.itemListElement?.length);
    console.log(JSON.stringify(j.itemListElement?.[0], null, 2).slice(0, 800));
  } else {
    console.log(JSON.stringify(j, null, 2).slice(0, 1500));
  }
}

// try to find JSON array after "realEstates"
const idx = html.indexOf('"realEstates"');
if (idx >= 0) {
  console.log("realEstates context", html.slice(idx, idx + 400));
}

const re = /"propertyId"\s*:\s*(\d+)[\s\S]{0,1200}?"price"\s*:\s*(\d+)/g;
let m;
let n = 0;
while ((m = re.exec(html)) && n < 2) {
  console.log("pair", m[1], m[2]);
  n++;
}

const hrefs = [...html.matchAll(/href="(\/es\/comprar\/vivienda\/[^"]+)"/g)].map((x) => x[1]);
console.log("vivienda hrefs", hrefs.length, hrefs.slice(0, 3));
