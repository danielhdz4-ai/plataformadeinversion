import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("https://kelify.com/es/login", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
const loginBtn = page.getByRole("button", { name: /Iniciar sesión/i }).first();
await loginBtn.click();
await page.waitForTimeout(3000);
const inputs = await page.$$eval("input", (els) =>
  els.map((e) => ({ type: e.type, name: e.name, placeholder: e.placeholder }))
);
console.log(JSON.stringify({ url: page.url(), inputs }, null, 2));
await browser.close();
