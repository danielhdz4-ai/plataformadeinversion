const url = "https://www.pisos.com/venta/pisos-madrid/";
const res = await fetch(url, {
  headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
});
const html = await res.text();
const re = /\/venta\/pisos-madrid\/([a-z0-9-]+)\//gi;
const slugs = new Set();
for (const m of html.matchAll(re)) slugs.add(m[1]);
console.log([...slugs].sort().join("\n"));
console.log("count", slugs.size);
