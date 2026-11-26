import { chromium } from "playwright";
import { kelifyLoginIfConfigured } from "./lib/kelify-auth.mjs";
import { collectKelifyCards } from "./lib/kelify-collect.mjs";
import { getCityConfig } from "./lib/spain-city.mjs";

const url = process.argv[2] ?? "https://kelify.com/venta/pisos/particulares/almeria/aguadulce";
const city = getCityConfig(process.argv[3] ?? "almeria");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await kelifyLoginIfConfigured(page);
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.waitForTimeout(6000);
const stats = await page.evaluate(() => ({
  cards: document.querySelectorAll("[data-property-card]").length,
  propIds: document.querySelectorAll("[data-property-id]").length,
  title: document.title,
}));
const batch = await collectKelifyCards(page, city, 50, { scrollRounds: 12 });
console.log(JSON.stringify({ url, stats, collected: batch.length, sample: batch.slice(0, 2) }));
await browser.close();
