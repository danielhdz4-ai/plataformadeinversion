const slugs = [
  "https://kelify.com/venta/pisos/aguadulce-almeria",
  "https://kelify.com/venta/pisos/particulares/aguadulce-almeria",
  "https://kelify.com/venta/pisos/almeria-aguadulce",
  "https://kelify.com/venta/pisos/particulares/almeria-aguadulce",
  "https://kelify.com/es/venta/pisos/aguadulce",
];
for (const url of slugs) {
  const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
  const t = await r.text();
  const n = (t.match(/data-property-id="/g) ?? []).length;
  const title = t.match(/<title>([^<]+)/)?.[1] ?? "";
  console.log(JSON.stringify({ status: r.status, n, title: title.slice(0, 70), url }));
}
