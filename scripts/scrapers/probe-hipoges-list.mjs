import { chromium } from "playwright";

const url = "https://realestate.hipoges.com/es/point/venta/pisos-y-casas/espana/5";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const reqs = [];
page.on("request", (req) => {
  const u = req.url();
  if (req.method() === "POST" || u.includes("/api/") || u.includes("Asset") || u.includes("asset")) {
    reqs.push({ method: req.method(), url: u.slice(0, 220), body: req.postData()?.slice(0, 300) });
  }
});
await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForTimeout(8000);
const text = await page.evaluate(() => document.body.innerText.slice(0, 2000));
console.log("body text sample", text.slice(0, 400));
console.log(JSON.stringify({ reqs: reqs.slice(0, 30) }, null, 2));
const cards = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("[class*='property'], [class*='card'], [class*='listing'], app-property-card")) {
    const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (t.length > 20 && t.includes("€")) out.push(t.slice(0, 120));
  }
  return out.slice(0, 10);
});
console.log("cards", cards);
await browser.close();
