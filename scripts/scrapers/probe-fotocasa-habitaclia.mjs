const urls = [
  ["fotocasa", "https://www.fotocasa.es/es/comprar/viviendas/espana/todas-las-zonas/l"],
  ["habitaclia", "https://www.habitaclia.com/viviendas-madrid.htm"],
];

for (const [name, u] of urls) {
  const r = await fetch(u, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PI/0.1)", Accept: "text/html" },
    redirect: "follow",
  });
  const t = await r.text();
  const next = t.includes("__NEXT_DATA__") || t.includes("application/json");
  const gql = /graphql|algolia|elastic|searchService|api\./i.test(t);
  console.log(JSON.stringify({ name, status: r.status, bytes: t.length, nextData: next, apiLike: gql }));
}
