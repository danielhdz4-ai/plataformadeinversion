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

/** Extrae tarjetas del HTML (SSR + DOM tras scroll). */
export function parseKelifyCardsFromHtml(html, city, limit, seen = new Set()) {
  const unique = [];
  const re =
    /data-property-id="([^"]+)"[\s\S]*?href="(\/venta\/pisos\/[^"]+)"[\s\S]*?(?:data-property-card|class="[^"]*property)/gi;
  let m;
  while ((m = re.exec(html)) != null && unique.length < limit) {
    const propertyId = m[1];
    const href = m[2];
    if (!propertyId || !href || seen.has(propertyId)) continue;
    if (!hrefMatchesCity(href.startsWith("http") ? href : `https://kelify.com${href}`, city)) continue;
    seen.add(propertyId);
    unique.push({ propertyId, href, text: "", thumb: "" });
  }
  if (unique.length >= limit) return unique;
  const blocks = [...html.matchAll(/data-property-id="([^"]+)"/g)];
  for (const b of blocks) {
    if (unique.length >= limit) break;
    const propertyId = b[1];
    if (seen.has(propertyId)) continue;
    const slice = html.slice(b.index, b.index + 4000);
    const hrefM = slice.match(/href="(\/venta\/pisos\/[^"]+)"/);
    if (!hrefM) continue;
    const href = hrefM[1];
    if (!hrefMatchesCity(`https://kelify.com${href}`, city)) continue;
    seen.add(propertyId);
    const textM = slice.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const thumbM = slice.match(/src="(https:\/\/img\.kelify\.com[^"]+)"/);
    unique.push({
      propertyId,
      href,
      text: textM.slice(0, 320),
      thumb: thumbM?.[1] ?? "",
    });
  }
  return unique;
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

  if (unique.length < limit) {
    const html = await page.content();
    for (const c of parseKelifyCardsFromHtml(html, city, limit - unique.length, seen)) {
      unique.push(c);
    }
  }
  return unique;
}
