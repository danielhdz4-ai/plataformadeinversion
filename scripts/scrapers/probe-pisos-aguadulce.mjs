import { parsePisosListingsFromHtml } from "./lib/parse-pisos-ld.mjs";

const wide = [-2.68, 36.7, -2.3, 37.0];
const narrow = [-2.53, 36.77, -2.39, 36.91];
const seen = new Set();
const wideBatch = [];
for (let p = 1; p <= 20; p++) {
  const url =
    p === 1
      ? "https://www.pisos.com/venta/pisos-almeria/"
      : `https://www.pisos.com/venta/pisos-almeria/${p}/`;
  const t = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "es-ES" } })).text();
  for (const row of parsePisosListingsFromHtml(t, { max: 999, bbox: wide })) {
    if (seen.has(row.externalId)) continue;
    seen.add(row.externalId);
    wideBatch.push(row);
  }
}
const narrowBatch = wideBatch.filter(
  (x) => x.lon >= narrow[0] && x.lon <= narrow[2] && x.lat >= narrow[1] && x.lat <= narrow[3]
);
const agu = wideBatch.filter(
  (x) =>
    x.lat > 36.75 &&
    x.lat < 36.83 &&
    x.lon < -2.54 &&
    (x.title?.toLowerCase().includes("aguadulce") || x.city?.toLowerCase().includes("aguadulce"))
);
console.log(
  JSON.stringify({
    wide: wideBatch.length,
    narrow: narrowBatch.length,
    aguadulceTagged: agu.length,
    sampleAgu: agu.slice(0, 3),
  })
);
