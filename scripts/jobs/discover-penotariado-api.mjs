const home = await (
  await fetch("https://www.penotariado.com/inmobiliario/es/home", {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
  })
).text();
const scripts = [...home.matchAll(/src="(\/inmobiliario\/_next\/static\/chunks\/[^"]+\.js)"/g)].map(
  (m) => m[1]
);
const hits = new Set();
for (const rel of scripts.slice(0, 35)) {
  const url = `https://www.penotariado.com${rel}`;
  let js = "";
  try {
    js = await (await fetch(url)).text();
  } catch {
    continue;
  }
  for (const m of js.matchAll(/https?:\\\/\\\/[^"'\\]+|https?:\/\/[^"'\\]+/g)) {
    let u = m[0].replace(/\\\//g, "/");
    if (/arcgis|FeatureServer|penotariado|geopro|MapServer|notariado|statistics|estad/i.test(u)) {
      hits.add(u.slice(0, 220));
    }
  }
}
console.log([...hits].slice(0, 40).join("\n"));
