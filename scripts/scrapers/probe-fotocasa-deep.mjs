const urls = [
  "https://www.fotocasa.es/es/comprar/viviendas/espana/todas-las-zonas/l",
  "https://www.fotocasa.es/es/comprar/viviendas/madrid-capital/todas-las-zonas/l",
  "https://www.fotocasa.es/es/comprar/viviendas/madrid-capital/todas-las-zonas/l/1",
];

for (const url of urls) {
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });
  const html = await r.text();
  const hasNext = html.includes("__NEXT_DATA__");
  const hasNuxt = html.includes("__NUXT__");
  const apis = [...new Set((html.match(/https:\/\/[^\"'\s]+/g) ?? []).filter((u) => /fotocasa|api|search|gateway/i.test(u)))].slice(0, 12);
  const ids = (html.match(/"propertyId"\s*:\s*(\d+)/g) ?? []).length;
  const realEstates = (html.match(/realEstates/g) ?? []).length;
  console.log(JSON.stringify({ url: url.slice(30, 80), status: r.status, len: html.length, hasNext, hasNuxt, ids, realEstates, apis: apis.slice(0, 4) }));
}
