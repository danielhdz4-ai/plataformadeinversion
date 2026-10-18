/**
 * Extrae slugs de barrios desde HTML Fotocasa.
 * node scripts/ops/fotocasa-list-districts.mjs valencia-capital > /tmp/z.txt
 */
const capital = process.argv[2] ?? "valencia-capital";
const url = `https://www.fotocasa.es/es/comprar/viviendas/${capital}/todas-las-zonas/l`;
const res = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
});
if (!res.ok) {
  console.error("HTTP", res.status);
  process.exit(1);
}
const html = await res.text();
const re = new RegExp(`/es/comprar/viviendas/${capital.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/([a-z0-9-]+)/l`, "gi");
const slugs = new Set();
for (const m of html.matchAll(re)) {
  if (m[1] !== "todas-las-zonas") slugs.add(m[1]);
}
console.log([...slugs].sort().join("\n"));
console.error("count", slugs.size);
