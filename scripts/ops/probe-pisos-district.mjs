import { parsePisosListingsFromHtml } from "../scrapers/lib/parse-pisos-ld.mjs";

const slug = process.argv[2] ?? "madrid/chamberi";
const url = `https://www.pisos.com/venta/pisos-${slug}/`;
const res = await fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; PlataformaInversion/0.1)",
    Accept: "text/html",
  },
});
console.log("status", res.status, url);
if (!res.ok) process.exit(1);
const html = await res.text();
const bbox = [-3.88, 40.31, -3.52, 40.56];
const batch = parsePisosListingsFromHtml(html, { max: 50, bbox, regionPattern: "madrid" });
console.log("parsed", batch.length);
