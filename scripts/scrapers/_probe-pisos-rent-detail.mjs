const url = "https://www.pisos.com/alquilar/atico-antiga_esquerra_de_eixample-66672467514_106100/";
const html = await (
  await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PlataformaInversion/0.1)",
      Accept: "text/html",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  })
).text();
for (const kw of [
  "price__value-container",
  "220 m²",
  "habitacion",
  "Habitaciones",
  "floorSize",
  "feature__label",
  "features__",
]) {
  const i = html.indexOf(kw);
  console.log("=== " + kw + " @" + i);
  if (i > 0) console.log(html.slice(Math.max(0, i - 450), i + 250).replace(/\s+/g, " "));
}
