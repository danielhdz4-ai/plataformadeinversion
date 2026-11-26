import { chromium } from "playwright";

const url = "https://www.habitaclia.com/comprar/viviendas/madrid-provincia/madrid-capital/s";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const bodies = [];
page.on("response", async (res) => {
  const u = res.url();
  if (!/gw\.habitaclia|api\.|graphql|search|listing|ads/i.test(u)) return;
  const ct = res.headers()["content-type"] ?? "";
  if (!ct.includes("json")) return;
  try {
    const j = await res.json();
    bodies.push({ u: u.slice(0, 100), keys: typeof j === "object" ? Object.keys(j).slice(0, 8) : null, sample: JSON.stringify(j).slice(0, 300) });
  } catch {
    /* ignore */
  }
});
await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(4000);
const links = await page.$$eval("a[href*='/comprar/']", (as) =>
  as.map((a) => a.getAttribute("href")).filter((h) => h && /\d/.test(h)).slice(0, 8)
);
console.log(JSON.stringify({ links, bodies: bodies.slice(0, 10) }, null, 2));
await browser.close();
