const DEFAULT_BBOX = [2.05, 41.32, 2.25, 41.48];

function parseCoord(v) {
  if (v == null) return NaN;
  if (typeof v === "number") return v;
  return Number(String(v).trim().replace(",", "."));
}

export function parsePisosListingsFromHtml(
  html,
  { operation = "sale", max = 30, bbox = DEFAULT_BBOX, regionPattern = null } = {}
) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const regionRe = regionPattern ? new RegExp(regionPattern, "i") : null;
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
    out.push({
      externalId: id,
      title: decodeHtml(j.name ?? "Inmueble"),
      sourceUrl: path.startsWith("http") ? path : `https://www.pisos.com${path}`,
      lat,
      lon,
      city: decodeHtml(j.address?.addressLocality ?? "Barcelona"),
      postalCode: j.address?.postalCode ?? null,
      price: extractPrice(j),
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
  if (j.offers?.price) return Number(j.offers.price);
  if (j.offers?.lowPrice) return Number(j.offers.lowPrice);
  return null;
}

function extractThumb(j) {
  if (typeof j.photo === "string") return j.photo;
  if (Array.isArray(j.photo) && j.photo[0]) return j.photo[0];
  if (typeof j.image === "string") return j.image;
  if (Array.isArray(j.image) && j.image[0]) return j.image[0];
  return null;
}
