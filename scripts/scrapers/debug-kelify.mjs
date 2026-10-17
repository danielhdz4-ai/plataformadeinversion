import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(
  "https://kelify.com/venta/pisos/particulares/barcelona/ciutat-vella/la-barceloneta",
  { waitUntil: "networkidle", timeout: 120_000 }
);
await page.waitForTimeout(8000);
const html = await page.locator("#search-properties").innerHTML().catch(() => "NO ROOT");
console.log("search-properties len", html.length);
console.log("snippet", html.slice(0, 800));
const links = await page.$$eval("a", (as) =>
  as.map((a) => a.getAttribute("href")).filter((h) => h && h.includes("venta"))
);
console.log("venta links", [...new Set(links)].slice(0, 15));
await browser.close();
