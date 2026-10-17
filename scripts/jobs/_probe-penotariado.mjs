const urls = [
  "https://www.penotariado.com/inmobiliario/en/home",
  "https://www.penotariado.com/inmobiliario/es/mapa-precio-real-vivienda",
  "https://www.penotariado.com/inmobiliario/es/mapa",
];

for (const u of urls) {
  const res = await fetch(u, { redirect: "follow" });
  const t = await res.text();
  const hits = [...t.matchAll(/https?:\/\/[^"'\s<>]+/g)]
    .map((m) => m[0])
    .filter((x) => /arcgis|FeatureServer|mapa|geo|api|estad/i.test(x));
  console.log("\n", u, res.status, "hits", hits.length);
  for (const h of [...new Set(hits)].slice(0, 12)) console.log(" ", h.slice(0, 120));
  const scripts = [...t.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
  console.log(" scripts", scripts.length);
  for (const s of scripts.slice(0, 5)) console.log("  ", s);
}

const home = await (await fetch(urls[0])).text();
const mainJs = home.match(/src="(\/[^"]+main[^"]+\.js)"/)?.[1];
if (mainJs) {
  const jsUrl = new URL(mainJs, urls[0]).href;
  console.log("\nfetch", jsUrl);
  const js = await (await fetch(jsUrl)).text();
  const arc = [...js.matchAll(/https?:\\\/\\\/[^"']+|https?:\/\/[^"']+/g)]
    .map((m) => m[0].replace(/\\\//g, "/"))
    .filter((x) => /arcgis|FeatureServer|notariado|mapa/i.test(x));
  console.log("arc hits", [...new Set(arc)].slice(0, 20));
}
