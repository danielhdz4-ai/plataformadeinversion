import { chromium } from "playwright";

const BASE = "https://www.habitaclia.com";

export const HABITACLIA_SALE_ZONES = [
  { path: "/comprar/viviendas/madrid-provincia/madrid-capital/s", name: "Madrid", ccaa: "Madrid" },
  { path: "/comprar/viviendas/barcelona-provincia/barcelona-capital/s", name: "Barcelona", ccaa: "Cataluña" },
  { path: "/comprar/viviendas/valencia-provincia/valencia-capital/s", name: "Valencia", ccaa: "Comunitat Valenciana" },
  { path: "/comprar/viviendas/sevilla-provincia/sevilla-capital/s", name: "Sevilla", ccaa: "Andalucía" },
  { path: "/comprar/viviendas/malaga-provincia/malaga-capital/s", name: "Málaga", ccaa: "Andalucía" },
  { path: "/comprar/viviendas/vizcaya-provincia/bilbao/s", name: "Bilbao", ccaa: "País Vasco" },
  { path: "/comprar/viviendas/zaragoza-provincia/zaragoza-capital/s", name: "Zaragoza", ccaa: "Aragón" },
  { path: "/comprar/viviendas/alicante-provincia/alicante-alacant/s", name: "Alicante", ccaa: "Comunitat Valenciana" },
];

function parseCardText(text) {
  const priceM = text.match(/(\d[\d.\s]*)\s*€/);
  const price = priceM ? Number(priceM[1].replace(/[\s.]/g, "")) : null;
  const sqmM = text.match(/(\d+)\s*m²/i);
  const bedsM = text.match(/(\d+)\s*hab/i);
  const bathsM = text.match(/(\d+)\s*baño/i);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const titleLine = lines.find((l) => /venta en/i.test(l)) ?? lines.find((l) => l.length > 15) ?? "Habitaclia";
  return {
    price,
    sqm: sqmM ? Number(sqmM[1]) : null,
    bedrooms: bedsM ? Number(bedsM[1]) : null,
    bathrooms: bathsM ? Number(bathsM[1]) : null,
    title: titleLine.slice(0, 200),
  };
}

function zoneUrl(zonePath, pageNum = 1) {
  return pageNum <= 1 ? `${BASE}${zonePath}` : `${BASE}${zonePath.replace(/\/s$/, `/s/${pageNum}`)}`;
}

async function parseListPage(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(4500);
  const raw = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    for (const a of document.querySelectorAll('a[href*="/comprar/"][href*="/d"]')) {
      const href = a.getAttribute("href") ?? "";
      const m = href.match(/([0-9a-f-]{36})\/d$/i);
      if (!m || seen.has(m[1])) continue;
      seen.add(m[1]);
      const card = a.closest("article") ?? a.closest("li") ?? a.parentElement?.parentElement;
      const text = card?.innerText ?? a.innerText ?? "";
      out.push({ id: m[1], href, text });
    }
    return out;
  });
  return raw.map((row) => {
    const meta = parseCardText(row.text);
    const sourceUrl = row.href.startsWith("http") ? row.href : `${BASE}${row.href}`;
    return {
      externalId: row.id,
      sourceUrl,
      ...meta,
      lat: null,
      lon: null,
      city: null,
      thumbnail: null,
    };
  });
}

export async function fetchHabitacliaListPage(zonePath, { pageNum = 1, browser: existing } = {}) {
  const url = zoneUrl(zonePath, pageNum);
  const ownBrowser = !existing;
  const browser = existing ?? (await chromium.launch({ headless: true }));
  const page = await browser.newPage();
  try {
    const listings = await parseListPage(page, url);
    return { url, listings };
  } finally {
    await page.close();
    if (ownBrowser) await browser.close();
  }
}

export async function createHabitacliaBrowser() {
  return chromium.launch({ headless: true });
}

export async function fetchHabitacliaWithBrowser(browser, zonePath, pageNum = 1) {
  const url = zoneUrl(zonePath, pageNum);
  const page = await browser.newPage();
  try {
    const listings = await parseListPage(page, url);
    return { url, listings };
  } finally {
    await page.close();
  }
}
