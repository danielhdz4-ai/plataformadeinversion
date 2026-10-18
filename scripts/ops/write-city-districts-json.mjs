/**
 * Genera scripts/scrape/{city}-districts.json desde Fotocasa.
 * node scripts/ops/write-city-districts-json.mjs valencia-capital valencia "Comunitat Valenciana" valencia
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const [capitalSlug, citySlug, ccaa, pisosCitySlug] = process.argv.slice(2);
if (!capitalSlug || !citySlug) {
  console.error("Usage: write-city-districts-json.mjs <fotocasa-capital> <citySlug> <ccaa> <pisosSlug>");
  process.exit(1);
}

const url = `https://www.fotocasa.es/es/comprar/viviendas/${capitalSlug}/todas-las-zonas/l`;
const res = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
});
const html = await res.text();
const re = new RegExp(
  `/es/comprar/viviendas/${capitalSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/([a-z0-9-]+)/l`,
  "gi"
);
const slugs = new Set();
for (const m of html.matchAll(re)) {
  if (m[1] !== "todas-las-zonas") slugs.add(m[1]);
}

const fotocasaZones = [...slugs].sort().map((slug) => ({
  slug: `${capitalSlug}/${slug}`,
  name: slug.replace(/-/g, " "),
  ccaa: ccaa ?? "",
  pisosDistrict: slug,
  pisosCitySlug: pisosCitySlug ?? citySlug,
  citySlug,
}));

const file = `${citySlug}-districts.json`;
const out = {
  description: `Barrios ${capitalSlug} — Fotocasa + pisos.com`,
  fotocasaCapital: capitalSlug,
  citySlug,
  pisosCitySlug: pisosCitySlug ?? citySlug,
  fotocasaZones,
};

writeFileSync(join(process.cwd(), "scripts/scrape", file), JSON.stringify(out, null, 2) + "\n");
console.log("wrote", file, fotocasaZones.length);
