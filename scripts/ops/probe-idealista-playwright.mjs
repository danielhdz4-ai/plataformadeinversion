import { chromium } from "playwright";

const path = process.argv[2] ?? "/venta-viviendas/valencia-valencia/eixample/";
const url = `https://www.idealista.com${path}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setExtraHTTPHeaders({ "Accept-Language": "es-ES,es;q=0.9" });
const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
console.log("status", res?.status(), url);
await page.waitForTimeout(4000);
const html = await page.content();
const cards = await page.$$eval("article[data-adid]", (els) =>
  els.slice(0, 5).map((el) => ({
    id: el.getAttribute("data-adid"),
    text: el.textContent?.replace(/\s+/g, " ").trim().slice(0, 120),
  }))
);
console.log("cards", cards.length, cards);
console.log("html len", html.length, "blocked", /captcha|datadome/i.test(html));
await browser.close();
