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
      propertyKind: propertyKindFromText(
        `${j.name ?? ""} ${j.description ?? ""} ${j["@type"] ?? ""}`
      ),
    });
  }
  return out;
}

/**
 * Normaliza la tipología (B8) a snake_case para `listings.property_kind`.
 * Sin esto el filtro residencial no puede excluir garajes, locales o naves.
 */
export function propertyKindFromText(text) {
  const t = String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/garaje|parking|plaza de aparcamiento/.test(t)) return "garaje";
  if (/trastero/.test(t)) return "trastero";
  if (/local comercial|local industrial|\blocal\b/.test(t)) return "local";
  if (/oficina/.test(t)) return "oficina";
  if (/\bnave\b|nave industrial/.test(t)) return "nave";
  if (/terreno|solar|parcela/.test(t)) return "terreno";
  if (/atico|duplex|penthouse/.test(t)) return "atico";
  if (/estudio|loft/.test(t)) return "estudio";
  if (/casa|chalet|adosado|pareado|villa|unifamiliar/.test(t)) return "casa";
  if (/piso|apartamento|vivienda/.test(t)) return "piso";
  return null;
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

/** Extrae el CP (5 dígitos) del slug de la URL de pisos.com (`...covadonga_centre08202-...`). */
export function postalCodeFromPisosUrl(sourceUrl) {
  if (!sourceUrl) return null;
  const m = String(sourceUrl).match(/(0[1-9]\d{3}|[1-4]\d{4}|5[0-2]\d{3})-\d{9,12}_\d+/);
  return m ? m[1] : null;
}

/** Ficha pisos.com: precio, m², dormitorios y CP (funciona en /comprar/ y /alquilar/). */
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
  return parsePisosDetailHtml(html);
}

/** Parseo puro de la ficha (testeable sin red). */
export function parsePisosDetailHtml(html) {
  // Precio: bloque destacado de la ficha (`2.295 €/mes` o `185.000 €`).
  const heroM = html.match(/price__value[^>]*>\s*([\d.]+)\s*(?:&euro;|€)/i);
  const euro = [...html.matchAll(/(\d{1,3}(?:\.\d{3})+)\s*(?:&euro;|€)/g)]
    .map((m) => parseSpanishEuroInt(m[1]))
    .filter((n) => n != null && n >= 15_000);
  const heroPrice = heroM ? parseSpanishEuroInt(heroM[1]) : null;
  const price = heroPrice ?? (euro.length ? Math.max(...euro) : null);

  // Superficie: preferir "Superficie construida"; si no, primera m² razonable.
  const builtM = html.match(/Superficie\s+construida[^0-9]{0,80}?(\d{2,4})\s*m/i);
  const usefulM = html.match(/Superficie\s+(?:&#xFA;til|útil)[^0-9]{0,80}?(\d{2,4})\s*m/i);
  const anyM = html.match(/(\d{2,4})\s*m(?:²|&#xB2;)/i);
  const sqm = Number(builtM?.[1] ?? usefulM?.[1] ?? anyM?.[1] ?? NaN);

  // Dormitorios: `Habitaciones: 3` o `3 habs.`
  const roomsM =
    html.match(/(?:Habitaciones|Dormitorios)\s*:\s*<\/span>\s*(?:<[^>]+>\s*)*(\d{1,2})/i) ??
    html.match(/(\d{1,2})\s*habs?\./i);
  const bedrooms = roomsM ? Number(roomsM[1]) : null;

  const cpM = html.match(/\b(0[1-9]\d{3}|[1-4]\d{4}|5[0-2]\d{3})\b/);
  return {
    price,
    sqm: Number.isFinite(sqm) && sqm >= 15 && sqm <= 2000 ? sqm : null,
    bedrooms: Number.isFinite(bedrooms) && bedrooms > 0 && bedrooms < 20 ? bedrooms : null,
    postalCode: cpM ? cpM[1] : null,
  };
}
