const url = process.argv[2] ?? "https://kelify.com/venta/pisos/particulares/almeria";
const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "es-ES" } });
const t = await r.text();
const agu = [...new Set([...t.matchAll(/href="([^"]*aguadulce[^"]*)"/gi)].map((m) => m[1]))];
const propIds = [...t.matchAll(/data-property-id="([^"]+)"/g)].map((m) => m[1]);
console.log(
  JSON.stringify({
    status: r.status,
    len: t.length,
    aguadulceHrefs: agu.slice(0, 12),
    propertyIds: propIds.length,
    aguadulceMentions: (t.match(/aguadulce/gi) ?? []).length,
  })
);
