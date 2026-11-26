const chunks = [
  "chunk-26FBERZ5",
  "chunk-FSEFELQU",
  "chunk-DMQVJKKS",
  "chunk-L7PNB2PQ",
  "chunk-3656LBSA",
];
for (const c of chunks) {
  const t = await (await fetch(`https://realestate.hipoges.com/${c}.js`)).text();
  const hits = new Set();
  for (const m of t.matchAll(/https?:\\\/\\\/[a-zA-Z0-9./_-]+/g)) {
    hits.add(m[0].replace(/\\\//g, "/"));
  }
  for (const m of t.matchAll(/https?:\/\/[a-zA-Z0-9./_-]+/g)) {
    hits.add(m[0]);
  }
  const api = [...hits].filter((u) => /api|asset|property|point|cercalia|search/i.test(u));
  if (api.length) console.log(c, api.join("\n  "));
}
