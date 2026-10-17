const res = await fetch("https://www.pisos.com/venta/pisos-barcelona/", {
  headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "es" },
});
const t = await res.text();
const blocks = [...t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
const j = JSON.parse(blocks[0][1]);
console.log(Object.keys(j));
console.log(JSON.stringify(j, null, 2));
