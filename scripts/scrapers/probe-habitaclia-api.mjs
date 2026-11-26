import { chromium } from "playwright";

const url = "https://www.habitaclia.com/viviendas-madrid.htm";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const hits = [];
page.on("response", async (res) => {
  const u = res.url();
  if (!/habitaclia|adevinta|search|listing|inmueble|api/i.test(u)) return;
  if (!u.includes("http")) return;
  hits.push({ u: u.slice(0, 120), status: res.status(), ct: res.headers()["content-type"]?.slice(0, 40) });
});
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);
const cards = await page.locator("[data-testid], .list-item, article").count();
console.log(JSON.stringify({ cards, hits: hits.slice(0, 25) }, null, 2));
await browser.close();
