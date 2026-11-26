import { parseFotocasaListingsFromHtml } from "./lib/parse-fotocasa-ld.mjs";

const url = process.argv[2] ?? "https://www.fotocasa.es/es/comprar/viviendas/madrid-capital/todas-las-zonas/l";
const r = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html",
    "Accept-Language": "es-ES,es;q=0.9",
  },
});
const html = await r.text();
const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
for (let i = 0; i < blocks.length; i++) {
  const j = JSON.parse(blocks[i]);
  console.log("block", i, j["@type"], j.itemListElement?.length ?? (Array.isArray(j) ? j.length : "—"));
}

try {
  const list = parseFotocasaListingsFromHtml(html, { max: 5 });
  console.log("parsed", list.length, list[0]);
} catch (e) {
  console.log("parse err", e.message);
}
