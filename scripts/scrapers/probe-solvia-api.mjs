import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const hits = [];
page.on("request", (req) => {
  if (req.url().includes("buscarInmuebles") && req.method() === "POST") {
    console.log("REQ", req.postData()?.slice(0, 800));
  }
});
page.on("response", async (res) => {
  const u = res.url();
  if (!u.includes("solvia.es/api/")) return;
  let body = "";
  try {
    body = (await res.text()).slice(0, 400);
  } catch {
    body = "";
  }
  hits.push({ method: res.request().method(), status: res.status(), url: u, body });
});
await page.goto("https://www.solvia.es/es/comprar/viviendas/madrid/madrid", {
  waitUntil: "networkidle",
  timeout: 120_000,
});
await page.waitForTimeout(3000);
for (const h of hits) {
  console.log(JSON.stringify(h));
}
await browser.close();
