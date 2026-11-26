const slug = process.argv[2] ?? "almeria";
const pages = Number(process.argv[3] ?? 5);
for (let p = 1; p <= pages; p++) {
  const url =
    p === 1
      ? `https://www.pisos.com/venta/pisos-${slug}/`
      : `https://www.pisos.com/venta/pisos-${slug}/${p}/`;
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html", "Accept-Language": "es-ES" },
  });
  const t = await r.text();
  let jsonld = 0;
  for (const b of t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(b[1]);
      if (j["@type"] === "Apartment" || j["@type"] === "SingleFamilyResidence") jsonld++;
    } catch {
      /* skip */
    }
  }
  const links = new Set(
    [...t.matchAll(/href="(\/venta\/[^"]+-(\d+)\/)"/g)].map((m) => m[2])
  );
  console.log(JSON.stringify({ page: p, status: r.status, jsonld, detailLinks: links.size }));
}
