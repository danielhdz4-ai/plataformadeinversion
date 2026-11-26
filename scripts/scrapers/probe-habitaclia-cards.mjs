import { chromium } from "playwright";

const url = "https://www.habitaclia.com/comprar/viviendas/madrid-provincia/madrid-capital/s";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(5000);

const cards = await page.evaluate(() => {
  const out = [];
  const anchors = document.querySelectorAll('a[href*="/comprar/"][href*="/d"]');
  for (const a of anchors) {
    const href = a.getAttribute("href") ?? "";
    const m = href.match(/([0-9a-f-]{36})\/d$/i);
    if (!m) continue;
    const id = m[1];
    const card = a.closest("article") ?? a.closest("[class*='card']") ?? a.parentElement?.parentElement;
    const text = card?.innerText ?? a.innerText ?? "";
    const priceM = text.match(/(\d[\d.]*)\s*€/);
    out.push({ id, href, price: priceM ? priceM[1].replace(/\./g, "") : null, text: text.slice(0, 120) });
    if (out.length >= 8) break;
  }
  return out;
});
console.log(JSON.stringify(cards, null, 2));
await browser.close();
