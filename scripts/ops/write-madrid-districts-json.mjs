import fs from "node:fs";
import path from "node:path";

const url = "https://www.fotocasa.es/es/comprar/viviendas/madrid-capital/todas-las-zonas/l";
const res = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
});
const html = await res.text();
const re = /\/es\/comprar\/viviendas\/madrid-capital\/([a-z0-9-]+)\/l/gi;
const slugs = new Set();
for (const m of html.matchAll(re)) {
  if (m[1] !== "todas-las-zonas") slugs.add(m[1]);
}
const fotocasaZones = [...slugs].sort().map((slug) => ({
  slug: `madrid-capital/${slug}`,
  name: slug.replace(/-/g, " "),
  ccaa: "Comunidad de Madrid",
  pisosDistrict: slug,
}));
const out = {
  description: "Distritos/barrios Madrid capital — Fotocasa + pisos.com",
  fotocasaZones,
};
const target = path.join(process.cwd(), "scripts/scrape/madrid-districts.json");
fs.writeFileSync(target, JSON.stringify(out, null, 2) + "\n");
console.log("wrote", target, fotocasaZones.length);
