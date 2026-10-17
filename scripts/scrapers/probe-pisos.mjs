const res = await fetch("https://www.pisos.com/venta/pisos-barcelona/", {
  headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "es" },
});
const t = await res.text();
console.log("status", res.status, "len", t.length);
const m = t.match(/\/venta\/[^"'\\s]+-\d+\//g);
console.log("sample", m?.slice(0, 8));
