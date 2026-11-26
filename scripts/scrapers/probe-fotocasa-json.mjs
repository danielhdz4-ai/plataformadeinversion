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
for (const marker of [
  "__NEXT_DATA__",
  "__INITIAL",
  "window.__",
  "realEstates",
  "searchResult",
  "propertySearch",
  "application/ld+json",
]) {
  console.log(marker, html.includes(marker));
}

const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
console.log("ld+json count", ld.length);
for (const m of ld.slice(0, 2)) {
  try {
    const j = JSON.parse(m[1]);
    console.log("ld type", j["@type"], Array.isArray(j) ? j.length : null);
  } catch {
    console.log("ld parse fail");
  }
}

const scriptChunks = [...html.matchAll(/<script[^>]*>([\s\S]{200,8000}?)<\/script>/g)]
  .map((m) => m[1])
  .filter((s) => s.includes("propertyId") || s.includes("realEstates"));
console.log("script chunks with property", scriptChunks.length);
if (scriptChunks[0]) console.log(scriptChunks[0].slice(0, 500));

const self = html.match(/https:\/\/www\.fotocasa\.es\/es\/comprar\/vivienda[^\"'\s]*/g);
console.log("detail urls sample", [...new Set(self ?? [])].slice(0, 5));
