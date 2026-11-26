import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("https://kelify.com/es/login", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(3000);
const inputs = await page.$$eval("input", (els) =>
  els.map((e) => ({
    type: e.type,
    name: e.name,
    id: e.id,
    placeholder: e.placeholder,
    autocomplete: e.autocomplete,
  }))
);
const buttons = await page.$$eval("button", (els) =>
  els.slice(0, 15).map((e) => ({ type: e.type, text: (e.textContent ?? "").trim().slice(0, 60) }))
);
console.log(JSON.stringify({ url: page.url(), inputs, buttons }, null, 2));
await browser.close();
