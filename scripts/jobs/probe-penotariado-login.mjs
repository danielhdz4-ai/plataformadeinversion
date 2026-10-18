import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { penotariadoLogin } from "./lib/penotariado-auth.mjs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0) process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const captured = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("response", async (res) => {
  const url = res.url();
  if (!/penotariado|notariado|arcgis|FeatureServer|estad|api/i.test(url)) return;
  if (!/json|geojson|Feature/i.test(url) && !url.includes("api")) return;
  let sample = "";
  try {
    const t = await res.text();
    sample = t.slice(0, 200);
  } catch {
    sample = "";
  }
  captured.push({ status: res.status(), url: url.slice(0, 180), sample });
});

const auth = await penotariadoLogin(page);
console.log(JSON.stringify({ auth }));

await page.goto("https://www.penotariado.com/inmobiliario/es/mapa", {
  waitUntil: "domcontentloaded",
  timeout: 90_000,
}).catch(() => null);
await page.waitForTimeout(8000);

const search = page.getByPlaceholder(/código postal|buscar/i).first();
if (await search.isVisible().catch(() => false)) {
  await search.fill("04001");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(6000);
}

console.log(JSON.stringify({ captured: captured.slice(0, 25) }, null, 2));
await browser.close();
