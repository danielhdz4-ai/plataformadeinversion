import { parsePisosListingsFromHtml } from "../scrapers/lib/parse-pisos-ld.mjs";

const slugs = process.argv.slice(2);
const bbox = [-25, 27, 5, 44];
for (const slug of slugs) {
  const res = await fetch(`https://www.pisos.com/venta/pisos-${slug}/`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) {
    console.log(slug, "HTTP", res.status);
    continue;
  }
  const parsed = parsePisosListingsFromHtml(await res.text(), { max: 30, bbox });
  const inCoruna = parsed.filter((p) => p.lat > 43 && p.lat < 43.5 && p.lon > -8.7 && p.lon < -8.1);
  const inCR = parsed.filter((p) => p.lat > 38.85 && p.lat < 39.05 && p.lon > -4.1 && p.lon < -3.75);
  const inVitoria = parsed.filter((p) => p.lat > 42.8 && p.lat < 42.92 && p.lon > -2.75 && p.lon < -2.55);
  console.log(
    JSON.stringify({
      slug,
      total: parsed.length,
      inCoruna: inCoruna.length,
      inCR: inCR.length,
      inVitoria: inVitoria.length,
      sample: parsed[0] ? { lat: parsed[0].lat, lon: parsed[0].lon, city: parsed[0].city } : null,
    })
  );
}
