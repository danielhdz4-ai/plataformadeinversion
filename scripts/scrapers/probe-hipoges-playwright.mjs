import { chromium } from "playwright";

const url =
  process.argv[2] ??
  "https://realestate.hipoges.com/es/point/venta/pisos-y-casas/espana/5";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const apis = [];
page.on("response", async (res) => {
  const u = res.url();
  if (/hipoges|hipogesgroup|point|realestate/i.test(u)) {
    let sample = "";
    try {
      sample = (await res.text()).slice(0, 120);
    } catch {
      /* skip */
    }
    apis.push({ status: res.status(), url: u.slice(0, 200), sample });
  }
});
await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForTimeout(5000);
const html = await page.content();
console.log(JSON.stringify({ title: await page.title(), htmlLen: html.length, apis: apis.slice(0, 20) }));
const hrefs = await page.$$eval("a[href]", (as) =>
  as.map((a) => a.getAttribute("href")).filter(Boolean).slice(0, 30)
);
console.log("hrefs", [...new Set(hrefs)].filter((h) => /venta|property|inmueble|detail|point/i.test(h)).slice(0, 20));
await browser.close();
