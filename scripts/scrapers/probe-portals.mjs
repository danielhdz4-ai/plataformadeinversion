async function probe(name, url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PlataformaInversion/0.1)",
      "Accept-Language": "es-ES,es;q=0.9",
      Accept: "text/html",
    },
    redirect: "follow",
  });
  const t = await r.text();
  const ld = (t.match(/application\/ld\+json/g) || []).length;
  const next = t.includes("__NEXT_DATA__");
  const links = [...new Set([...t.matchAll(/href="(\/[^"]*(?:property|inmueble|vivienda|detail|venta)[^"]*)"/gi)].map((m) => m[1]))].slice(
    0,
    12
  );
  console.log(JSON.stringify({ name, status: r.status, len: t.length, jsonLd: ld, next, sampleHrefs: links }));
}

await probe(
  "hipoges",
  process.argv[2] ?? "https://realestate.hipoges.com/es/point/venta/pisos-y-casas/espana/5"
);
await probe(
  "solvia",
  process.argv[3] ?? "https://www.solvia.es/es/comprar/viviendas?texto=madrid&palabraClave=true"
);
