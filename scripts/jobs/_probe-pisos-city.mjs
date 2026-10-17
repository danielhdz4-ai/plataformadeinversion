import { parsePisosListingsFromHtml } from "../scrapers/lib/parse-pisos-ld.mjs";

const slug = process.argv[2] ?? "a-coruna";
const bbox = process.argv[3]?.split(",").map(Number);
const res = await fetch(`https://www.pisos.com/venta/pisos-${slug}/`, {
  headers: { "User-Agent": "Mozilla/5.0" },
});
const html = await res.text();
const latCount = (html.match(/latitude/g) ?? []).length;
const parsed = parsePisosListingsFromHtml(html, {
  max: 5,
  bbox: bbox?.length === 4 ? bbox : [-25, 27, 5, 44],
});
console.log(JSON.stringify({ slug, status: res.status, latCount, parsed: parsed.length, sample: parsed[0] }));
