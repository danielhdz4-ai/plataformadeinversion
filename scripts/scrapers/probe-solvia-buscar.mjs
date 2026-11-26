import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
let postBody = null;
page.on("request", (req) => {
  if (req.url().includes("buscarInmuebles") && req.method() === "POST") {
    postBody = req.postDataJSON();
  }
});
await page.goto("https://www.solvia.es/es/comprar/viviendas/madrid/madrid", {
  waitUntil: "networkidle",
  timeout: 120_000,
});
console.log(JSON.stringify({ postBody }, null, 2));

const res = await fetch("https://www.solvia.es/api/inmuebles/v2/buscarInmuebles", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0",
    Origin: "https://www.solvia.es",
    Referer: "https://www.solvia.es/es/comprar/viviendas/madrid/madrid",
  },
  body: JSON.stringify(postBody ?? { pagina: 1, tamanoPagina: 24 }),
});
const json = await res.json();
const first = json.inmuebles?.[0];
console.log(
  JSON.stringify({
    status: res.status,
    total: json.inmuebles?.length,
    totalRecords: json.totalRegistros ?? json.total,
    sample: first,
  }).slice(0, 1200)
);
await browser.close();
