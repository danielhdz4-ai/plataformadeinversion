const slug = process.argv[2] ?? "a-coruna";
const html = await (await fetch(`https://www.pisos.com/venta/pisos-${slug}/`)).text();
const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
const types = new Map();
for (const b of blocks) {
  try {
    const j = JSON.parse(b[1]);
    const t = j["@type"];
    types.set(t, (types.get(t) ?? 0) + 1);
  } catch {
    /* */
  }
}
console.log(Object.fromEntries(types));
