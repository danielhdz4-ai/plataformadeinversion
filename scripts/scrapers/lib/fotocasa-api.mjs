const BASE = "https://www.fotocasa.es";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "es-ES,es;q=0.9",
};

/** Provincia / zona → slug en URL Fotocasa (venta viviendas). */
export const FOTOCASA_SALE_ZONES = [
  { slug: "madrid-capital", name: "Madrid", ccaa: "Madrid" },
  { slug: "barcelona-capital", name: "Barcelona", ccaa: "Cataluña" },
  { slug: "valencia-capital", name: "Valencia", ccaa: "Comunitat Valenciana" },
  { slug: "sevilla-capital", name: "Sevilla", ccaa: "Andalucía" },
  { slug: "malaga-capital", name: "Málaga", ccaa: "Andalucía" },
  { slug: "bilbao", name: "Bilbao", ccaa: "País Vasco" },
  { slug: "zaragoza-capital", name: "Zaragoza", ccaa: "Aragón" },
  { slug: "alicante-alacant", name: "Alicante", ccaa: "Comunitat Valenciana" },
  { slug: "murcia-capital", name: "Murcia", ccaa: "Murcia" },
  { slug: "palma-de-mallorca", name: "Palma", ccaa: "Illes Balears" },
  { slug: "las-palmas-de-gran-canaria", name: "Las Palmas", ccaa: "Canarias" },
  { slug: "a-coruna", name: "A Coruña", ccaa: "Galicia" },
];

export function fotocasaSaleListUrl(zoneSlug, page = 1) {
  const base = `${BASE}/es/comprar/viviendas/${zoneSlug}/todas-las-zonas/l`;
  return page <= 1 ? base : `${base}/${page}`;
}

function extractPropertyObjects(html) {
  const marker = '"propertyId":';
  const out = [];
  let pos = 0;
  while (true) {
    const i = html.indexOf(marker, pos);
    if (i < 0) break;
    let start = i;
    while (start > 0 && html[start] !== "{") start--;
    if (html[start] !== "{") {
      pos = i + marker.length;
      continue;
    }
    let depth = 0;
    let end = start;
    for (; end < html.length; end++) {
      const ch = html[end];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end++;
          break;
        }
      }
    }
    const slice = html.slice(start, end);
    try {
      const obj = JSON.parse(slice);
      if (obj?.propertyId) out.push(obj);
    } catch {
      /* skip malformed */
    }
    pos = end;
  }
  return out;
}

function featureValue(features, key) {
  const f = (features ?? []).find((x) => x?.key === key);
  return f?.value ?? null;
}

function firstImage(multimedia) {
  if (!multimedia) return null;
  if (Array.isArray(multimedia)) {
    const img = multimedia.find((m) => m?.type === "image" || m?.url);
    return img?.url ?? img?.src ?? null;
  }
  if (multimedia.images?.[0]?.url) return multimedia.images[0].url;
  return null;
}

export function mapFotocasaProperty(row) {
  const id = String(row.propertyId);
  const price = Number(row.price ?? row.rawPrice ?? 0) || null;
  const path =
    row.detail?.["es-ES"] ??
    row.detailWithParams?.["es-ES"]?.split("?")[0] ??
    `/es/comprar/vivienda/${id}/d`;
  const sourceUrl = path.startsWith("http") ? path : `${BASE}${path}`;
  const addr = row.address ?? {};
  const lat = parseCoord(addr.coordinates?.lat ?? row.latitude);
  const lon = parseCoord(addr.coordinates?.lng ?? row.longitude);
  const city = addr.locality ?? addr.municipality ?? row.locationCardView?.locality ?? null;
  const sub = row.propertySubtype;
  const typeName =
    (typeof sub === "object" ? sub?.name : sub) ?? row.propertyType?.name ?? "Vivienda";
  const zone = row.locationCardView?.zone ?? row.location ?? city;
  const title = `${typeName} · ${row.locationCardView?.address ?? zone ?? city ?? id}`.slice(0, 200);
  return {
    externalId: id,
    title,
    price,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    city,
    postalCode: addr.zipCode ?? null,
    sqm: featureValue(row.features, "surface"),
    bedrooms: featureValue(row.features, "rooms"),
    bathrooms: featureValue(row.features, "bathrooms"),
    thumbnail: firstImage(row.multimedia),
    sourceUrl,
  };
}

export function parseFotocasaListingsFromHtml(html, { max = 40 } = {}) {
  const raw = extractPropertyObjects(html);
  const seen = new Set();
  const listings = [];
  for (const row of raw) {
    if (listings.length >= max) break;
    const id = String(row.propertyId);
    if (seen.has(id)) continue;
    seen.add(id);
    const mapped = mapFotocasaProperty(row);
    if (mapped.price != null && mapped.price < 5000) continue;
    listings.push(mapped);
  }
  return listings;
}

function parseCoord(v) {
  if (v == null) return NaN;
  return Number(String(v).replace(",", "."));
}

export async function fetchFotocasaListPage(zoneSlug, page = 1) {
  const url = fotocasaSaleListUrl(zoneSlug, page);
  const res = await fetch(url, { headers: DEFAULT_HEADERS });
  if (!res.ok) throw new Error(`Fotocasa HTTP ${res.status} ${url}`);
  const html = await res.text();
  return { html, url, listings: parseFotocasaListingsFromHtml(html) };
}
