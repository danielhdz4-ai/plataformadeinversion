const url = "https://www.solvia.es/es/comprar/viviendas?texto=madrid&palabraClave=true";
const t = await (
  await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html", "Accept-Language": "es-ES" },
  })
).text();
for (const b of t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
  try {
    const j = JSON.parse(b[1]);
    console.log("ld type", j["@type"], Array.isArray(j) ? j.length : "");
    if (j["@type"] === "ItemList" || Array.isArray(j)) {
      console.log(JSON.stringify(j).slice(0, 500));
    }
  } catch {
    /* skip */
  }
}
const cards = [...t.matchAll(/\/es\/comprar-inmueble\/[^"'\\s]+/g)].map((m) => m[0]);
console.log("detail paths", [...new Set(cards)].slice(0, 15));
console.log("count unique detail", new Set(cards).size);
