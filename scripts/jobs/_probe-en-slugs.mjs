import { parsePisosListingsFromHtml } from "../scrapers/lib/parse-pisos-ld.mjs";

const paths = [
  ["a-coruna", "pisos-en-a-coruna", [-8.7, 43.2, -8.1, 43.45]],
  ["ciudad-real", "pisos-en-ciudad-real", [-4.1, 38.85, -3.75, 39.05]],
  ["vitoria", "pisos-en-vitoria", [-2.75, 42.8, -2.55, 42.92]],
];

for (const [name, path, bbox] of paths) {
  const res = await fetch(`https://www.pisos.com/venta/${path}/`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const parsed = parsePisosListingsFromHtml(await res.text(), { max: 30, bbox });
  console.log(JSON.stringify({ name, path, status: res.status, inBbox: parsed.length, sample: parsed[0] }));
}
