import { chromium } from "playwright";

let postBody = null;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("request", (req) => {
  if (req.url().includes("/api/assets/listing") && req.method() === "POST") {
    postBody = req.postDataJSON();
  }
});
await page.goto("https://realestate.hipoges.com/es/point/venta/pisos-y-casas/espana/5", {
  waitUntil: "networkidle",
  timeout: 120_000,
});
await page.waitForTimeout(3000);
console.log(JSON.stringify(postBody, null, 2).slice(0, 2500));
await browser.close();
