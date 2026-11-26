const t = await (
  await fetch("https://kelify.com/venta/pisos/particulares/almeria", {
    headers: { "User-Agent": "Mozilla/5.0" },
  })
).text();
const h = [...t.matchAll(/href="(\/venta\/pisos\/[^"]+)"/g)].map((m) => m[1]);
const u = [...new Set(h)].filter((x) => x.includes("almeria") || x.includes("aguadulce"));
console.log(u.join("\n"));
