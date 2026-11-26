import { chromium } from "playwright";

const url =
  process.argv[2] ??
  "https://www.solvia.es/es/comprar/viviendas/madrid/madrid";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const apis = [];
page.on("response", async (res) => {
  const u = res.url();
  if (/solvia|api|search|inmueble|vivienda|graphql|elastic/i.test(u)) {
    const ct = res.headers()["content-type"] ?? "";
    if (!/json|javascript/i.test(ct) && !u.includes("api")) return;
    let sample = "";
    try {
      sample = (await res.text()).slice(0, 150);
    } catch {
      /* skip */
    }
    apis.push({ status: res.status(), url: u.slice(0, 220), sample });
  }
});
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.waitForTimeout(8000);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(3000);
const links = await page.$$eval("a[href]", (as) =>
  as.map((a) => a.getAttribute("href") ?? "").filter((h) => h.includes("comprar"))
);
console.log(JSON.stringify({ title: await page.title(), listingLinks: [...new Set(links)].slice(0, 25) }));
console.log(JSON.stringify({ apis: apis.slice(0, 25) }, null, 2));
await browser.close();
