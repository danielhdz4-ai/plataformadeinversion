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
const id = "191068742";
const idx = html.indexOf(id);
console.log("idx", idx);
console.log(html.slice(idx - 200, idx + 800));

// try split by propertyId
const parts = html.split(/"propertyId":/);
console.log("parts", parts.length);
if (parts[1]) {
  const chunk = `"propertyId":${parts[1].slice(0, 1200)}`;
  console.log(chunk);
}
