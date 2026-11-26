import { readFileSync } from "node:fs";

const url =
  process.argv[2] ??
  "https://www.fotocasa.es/es/comprar/viviendas/espana/todas-las-zonas/l?sortType=publicationDate";

const r = await fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; PlataformaInversion/0.1)",
    Accept: "text/html",
    "Accept-Language": "es-ES,es;q=0.9",
  },
});
const html = await r.text();
const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
if (!m) {
  console.log("no __NEXT_DATA__", r.status);
  process.exit(1);
}
const data = JSON.parse(m[1]);
const pathKeys = [];
function walk(o, depth = 0) {
  if (!o || depth > 6) return;
  if (Array.isArray(o) && o.length > 0 && o[0]?.id && o[0]?.price) {
    pathKeys.push({ sample: o[0], len: o.length });
    return;
  }
  if (typeof o !== "object") return;
  for (const [k, v] of Object.entries(o)) {
    if (k === "realEstates" || k === "properties" || k === "search" || k === "result") {
      pathKeys.push({ key: k, type: Array.isArray(v) ? `array:${v?.length}` : typeof v });
    }
    walk(v, depth + 1);
  }
}
walk(data);
console.log(JSON.stringify({ status: r.status, topKeys: Object.keys(data), hints: pathKeys.slice(0, 15) }, null, 2));

// dump shallow path to listings if obvious
const pp = data?.props?.pageProps;
console.log("pageProps keys", pp ? Object.keys(pp) : null);
if (pp?.initialSearch?.result?.realEstates) {
  const list = pp.initialSearch.result.realEstates;
  console.log("realEstates count", list.length, "sample keys", Object.keys(list[0] ?? {}));
  console.log(JSON.stringify(list[0], null, 2).slice(0, 1200));
}
