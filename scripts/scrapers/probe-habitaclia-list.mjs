const url = process.argv[2] ?? "https://www.habitaclia.com/viviendas-madrid.htm";
const r = await fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; PlataformaInversion/0.1)",
    Accept: "text/html",
  },
});
const html = await r.text();
const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
const cards = (html.match(/habitaclia\.com\/[\w-]+-\d+\.htm/gi) ?? []).slice(0, 5);
const price = html.match(/data-price="(\d+)"/);
console.log(
  JSON.stringify({
    status: r.status,
    bytes: html.length,
    ldScripts: ld?.length ?? 0,
    sampleLinks: cards,
    dataPrice: price?.[1],
    hasReactRoot: html.includes("id=\"root\"") || html.includes("__NUXT__"),
  })
);
