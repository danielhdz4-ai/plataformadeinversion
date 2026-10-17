export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function hrefMatchesCity(href, city) {
  const h = href.toLowerCase();
  const needles = [
    city.kelifySlug ?? city.slug,
    city.slug,
    city.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/\s+/g, "-"),
  ].filter(Boolean);
  return needles.some((n) => h.includes(`/venta/pisos/${n}/`) || h.includes(`/venta/pisos/particulares/${n}`));
}

/** Descubre enlaces de barrio/zona en la página de listado. */
export async function discoverKelifySubListUrls(page, city) {
  const hrefs = await page.$$eval('a[href*="/venta/pisos/"]', (nodes) =>
    nodes.map((a) => a.getAttribute("href") ?? "").filter(Boolean)
  );
  const slug = city.kelifySlug ?? city.slug;
  const out = new Set();
  for (let h of hrefs) {
    if (!h.includes("particulares") && !h.includes(`/venta/pisos/${slug}`)) continue;
    if (!h.startsWith("http")) h = `https://kelify.com${h.startsWith("/") ? "" : "/"}${h}`;
    if (hrefMatchesCity(h, city)) out.add(h.split("?")[0]);
  }
  return [...out];
}

export async function collectKelifyCards(page, city, limit, { scrollRounds = 45 } = {}) {
  const unique = [];
  const seen = new Set();

  for (let round = 0; round < scrollRounds && unique.length < limit; round++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(round < 5 ? 900 : 550);
    const cards = await page.$$eval("[data-property-card]", (nodes) =>
      nodes.map((el) => {
        const root = el.closest("[data-property-id]") ?? el;
        const propertyId = root.getAttribute("data-property-id") ?? "";
        const link = el.querySelector("a[href*='/venta/pisos/']");
        const href = link?.getAttribute("href") ?? "";
        const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
        const img = el.querySelector("img");
        const thumb = img?.getAttribute("src") ?? img?.getAttribute("data-src") ?? "";
        return { propertyId, href, text, thumb };
      })
    );
    let added = 0;
    for (const c of cards) {
      if (unique.length >= limit) break;
      if (!c.propertyId || !c.href || seen.has(c.propertyId)) continue;
      if (!hrefMatchesCity(c.href, city)) continue;
      seen.add(c.propertyId);
      unique.push(c);
      added++;
    }
    if (added === 0 && round > 8) break;
  }
  return unique;
}
