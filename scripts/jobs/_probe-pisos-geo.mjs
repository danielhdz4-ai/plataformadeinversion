const slug = process.argv[2] ?? "a-coruna";
const html = await (await fetch(`https://www.pisos.com/venta/pisos-${slug}/`)).text();
const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
let n = 0;
for (const b of blocks) {
  try {
    const j = JSON.parse(b[1]);
    if (j["@type"] !== "SingleFamilyResidence" && j["@type"] !== "Apartment") continue;
    n++;
    if (n <= 3) console.log({ type: j["@type"], geo: j.geo, city: j.address?.addressLocality });
  } catch {
    /* */
  }
}
console.log("total", n);
