const DEFAULT_BBOX = [2.05, 41.32, 2.25, 41.48];

function parseCoord(v) {
  if (v == null) return NaN;
  if (typeof v === "number") return v;
  return Number(String(v).trim().replace(",", "."));
}

/** Precio español: 169.000 € → 169000 */
export function parseSpanishEuroInt(raw) {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  const s = String(raw).replace(/[^\d.,]/g, "").trim();
  if (!s) return null;
  const normalized =
    s.includes(".") && s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/\./g, "");
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 1000 ? Math.round(n) : null;
}

/** Precio y m² desde tarjetas HTML (el JSON-LD de listado suele ir sin offers). */
export function buildPisosListMetaFromHtml(html) {
  const meta = new Map();
  for (const m of html.matchAll(
    /(\d{1,3}(?:\.\d{3})+)\s*€([\s\S]{0,2800}?)(\d{9,12})_\d+\//gi
  )) {
    const price = parseSpanishEuroInt(m[1]);
    const listingId = m[3];
    if (!price || !listingId) continue;
    const sqmM = m[2].match(/(\d{2,3})\s*m²/i);
    const sqm = sqmM ? Number(sqmM[1]) : null;
    meta.set(listingId, {
      price,
      sqm: Number.isFinite(sqm) && sqm >= 15 && sqm <= 2000 ? sqm : null,
    });
  }
  return meta;
}

export function parsePisosListingsFromHtml(
  html,
  { operation = "sale", max = 30, bbox = DEFAULT_BBOX, regionPattern = null } = {}
) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const regionRe = regionPattern ? new RegExp(regionPattern, "i") : null;
  const cardMeta = buildPisosListMetaFromHtml(html);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const out = [];
  const seen = new Set();
  for (const b of blocks) {
    if (out.length >= max) break;
    let j;
    try {
      j = JSON.parse(b[1]);
    } catch {
      continue;
    }
    if (j["@type"] !== "SingleFamilyResidence" && j["@type"] !== "Apartment") continue;
    const id = String(j["@id"] ?? "").split(".")[0];
    if (!id || seen.has(id)) continue;
    const region = j.address?.addressRegion ?? "";
    if (regionRe && region && !regionRe.test(region)) continue;
    const lat = parseCoord(j.geo?.latitude);
    const lon = parseCoord(j.geo?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < minLat || lat > maxLat || lon < minLng || lon > maxLng) continue;
    const path = j.url ?? "";
    seen.add(id);
    const fromCard = cardMeta.get(id);
    const price = extractPrice(j) ?? fromCard?.price ?? null;
    const sqm = extractSqm(j) ?? fromCard?.sqm ?? null;
    out.push({
      externalId: id,
      title: decodeHtml(j.name ?? "Inmueble"),
      sourceUrl: path.startsWith("http") ? path : `https://www.pisos.com${path}`,
      lat,
      lon,
      city: decodeHtml(j.address?.addressLocality ?? "Barcelona"),
      postalCode: j.address?.postalCode ?? null,
      price,
      sqm,
      thumbnail: extractThumb(j),
      bedrooms: j.numberOfRooms ?? j.numberOfBedrooms ?? null,
      bathrooms: j.numberOfBathroomsTotal ?? null,
    });
  }
  return out;
}

function decodeHtml(s) {
  return s
    .replace(/&#x27;/g, "'")
    .replace(/&#xE9;/gi, "é")
    .replace(/&amp;/g, "&");
}

function extractPrice(j) {
  const o = j.offers;
  if (!o) return null;
  if (Array.isArray(o)) return extractPrice({ ...j, offers: o[0] });
  const candidates = [o.price, o.lowPrice, o.highPrice, o.priceSpecification?.price];
  for (const c of candidates) {
    const p = parseSpanishEuroInt(c);
    if (p) return p;
  }
  return null;
}

function extractSqm(j) {
  const fs = j.floorSize;
  if (typeof fs === "number" && fs > 0) return Math.round(fs);
  if (fs?.value != null) {
    const n = Number(fs.value);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return null;
}

function extractThumb(j) {
  if (typeof j.photo === "string") return j.photo;
  if (Array.isArray(j.photo) && j.photo[0]) return j.photo[0];
  if (typeof j.image === "string") return j.image;
  if (Array.isArray(j.image) && j.image[0]) return j.image[0];
  return null;
}

/** Ficha /comprar/ cuando falta precio en listado. */
export async function fetchPisosDetailFields(sourceUrl) {
  const res = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PlataformaInversion/0.1)",
      Accept: "text/html",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const euro = [...html.matchAll(/(\d{1,3}(?:\.\d{3})+)\s*€/g)]
    .map((m) => parseSpanishEuroInt(m[1]))
    .filter((n) => n != null && n >= 15_000);
  const price = euro.length ? Math.max(...euro) : null;
  const sqmM = html.match(/(\d{2,3})\s*m²/i);
  const sqm = sqmM ? Number(sqmM[1]) : null;
  return {
    price,
    sqm: Number.isFinite(sqm) && sqm >= 15 && sqm <= 2000 ? sqm : null,
  };
}
