const url = "https://www.habitaclia.com/viviendas-madrid.htm";
const r = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html",
  },
});
const html = await r.text();
const patterns = [
  /data-id="(\d+)"/g,
  /\/(\d+)\/d\.htm/g,
  /vivienda[^"]*-(\d{6,})\.htm/gi,
  /"price"\s*:\s*(\d+)/g,
  /listado-anuncio/g,
];
for (const re of patterns) {
  const m = [...html.matchAll(re)];
  console.log(re.source.slice(0, 40), m.length, m[0]?.[1] ?? m[0]?.[0]?.slice(0, 40));
}

const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
for (const block of ld) {
  const j = JSON.parse(block[1]);
  console.log("ld", j["@type"], j.itemListElement?.length);
  if (j.itemListElement?.[0]) console.log(JSON.stringify(j.itemListElement[0], null, 2).slice(0, 600));
}
