const base = "https://www.penotariado.com/inmobiliario/_next/static/chunks/";
const home = await (await fetch("https://www.penotariado.com/inmobiliario/en/home")).text();
const chunks = [...home.matchAll(/\/inmobiliario\/_next\/static\/chunks\/[^"]+\.js/g)].map((m) =>
  m[0].replace("/inmobiliario/_next/static/chunks/", "")
);

for (const c of chunks) {
  const t = await (await fetch(base + c)).text();
  const raw = [...t.matchAll(/https?:\\\/\\\/[a-zA-Z0-9._/-]+/g)].map((x) => x[0].replace(/\\\//g, "/"));
  const plain = [...t.matchAll(/https?:\/\/[a-zA-Z0-9._/-]+/g)].map((x) => x[0]);
  const hits = [...new Set([...raw, ...plain])].filter((u) =>
    /arcgis|FeatureServer|notariado\.org|geoportal|estad/i.test(u)
  );
  if (hits.length) {
    console.log("\n", c, hits.length);
    hits.forEach((h) => console.log(" ", h));
  }
}
