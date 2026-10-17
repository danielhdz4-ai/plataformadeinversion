import { parseKelifyCardsFromHtml, sleep } from "./kelify-collect.mjs";
import { kelifyListingUrls } from "./kelify-urls.mjs";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; PlataformaInversion-Kelify/1.0)",
  Accept: "text/html",
  "Accept-Language": "es-ES,es;q=0.9",
};

export async function fetchKelifyListHtml(url) {
  const res = await fetch(url, { headers: HEADERS, redirect: "follow" });
  if (!res.ok) return null;
  return res.text();
}

/** Listados vía HTTP (sin login). Kelify expone tarjetas en SSR. */
export async function collectKelifyCardsViaFetch(city, limit) {
  const seen = new Set();
  const unique = [];
  const bases = kelifyListingUrls(city);
  const maxPages = Number(process.env.KELIFY_FETCH_PAGES ?? "12");

  for (const base of bases) {
    let emptyStreak = 0;
    for (let page = 1; page <= maxPages && unique.length < limit; page++) {
      const url =
        page === 1
          ? base
          : `${base.replace(/\/$/, "")}?page=${page}`;
      const html = await fetchKelifyListHtml(url);
      if (!html) {
        emptyStreak++;
        if (emptyStreak >= 2) break;
        continue;
      }
      const batch = parseKelifyCardsFromHtml(html, city, limit - unique.length, seen);
      if (batch.length === 0) {
        emptyStreak++;
        if (emptyStreak >= 2) break;
      } else emptyStreak = 0;
      unique.push(...batch);
      if (page > 1) await sleep(350);
    }
  }
  return unique;
}
