import {
  cachedFuzzyHits,
  getCachedGeocodeHits,
  getCachedPostalHit,
  setCachedGeocodeHits,
  setCachedPostalHit,
  setFuzzyHits,
} from "@/lib/map/geocode-cache";
import { fetchCpCentroidFromDb, upsertCpCentroid } from "@/lib/map/geocode-cp-centroid.server";
import { SPAIN_BBOX } from "@/lib/map/spain-bounds";

export { ZONE_STOCK_TARGET } from "@/lib/map/cp-zone-stock";

export type GeocodeHit = {
  label: string;
  lat: number;
  lng: number;
  bbox: [number, number, number, number] | null;
};

type NominatimItem = {
  lat: string;
  lon: string;
  display_name: string;
  class?: string;
  type?: string;
  boundingbox?: [string, string, string, string];
  address?: {
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    suburb?: string;
    borough?: string;
    quarter?: string;
    neighbourhood?: string;
    city_district?: string;
    county?: string;
  };
};

/** Tipos que representan barrio/ciudad (no calle, estación ni comercio). */
const PLACE_TYPES = new Set([
  "administrative",
  "city",
  "town",
  "village",
  "municipality",
  "suburb",
  "borough",
  "quarter",
  "neighbourhood",
  "city_district",
  "district",
  "hamlet",
  "locality",
]);

function isPlaceItem(item: NominatimItem): boolean {
  if (item.class === "boundary" && item.type === "administrative") return true;
  if (item.class === "place" && PLACE_TYPES.has(item.type ?? "")) return true;
  if (item.class === "highway" || item.class === "railway" || item.class === "amenity") return false;
  return PLACE_TYPES.has(item.type ?? "");
}

/** Nombre del lugar (barrio, municipio o ciudad) del resultado. */
function placeName(item: NominatimItem): string {
  const a = item.address;
  return (
    a?.suburb ??
    a?.borough ??
    a?.neighbourhood ??
    a?.quarter ??
    a?.city_district ??
    a?.borough ??
    a?.town ??
    a?.village ??
    a?.municipality ??
    a?.city ??
    item.display_name.split(",")[0]?.trim() ??
    ""
  );
}

/**
 * Algunos barrios no existen como polígono en OSM: Nominatim devuelve el código postal
 * del área ("San Blas, Madrid" → CP 28037). Lo presentamos como CP seleccionable.
 */
function formatPostalLabel(item: NominatimItem): string {
  const a = item.address ?? {};
  const pc = a.postcode?.replace(/\s/g, "").slice(0, 5) ?? "";
  const locality = a.city ?? a.town ?? a.village ?? a.municipality ?? "";
  return [`CP ${pc}`, locality, a.state ?? "", "España"].filter(Boolean).join(", ");
}

/** Etiqueta legible y sin duplicados para el selector de ubicación. */
function formatPlaceLabel(item: NominatimItem): string {
  const a = item.address ?? {};
  const name = placeName(item);
  const locality =
    a.suburb && a.city && a.suburb !== a.city
      ? a.city
      : a.town ?? a.village ?? a.municipality ?? a.city ?? a.county ?? "";
  const pc = a.postcode?.replace(/\s/g, "").slice(0, 5) ?? "";
  const parts = [name, locality && locality !== name ? locality : "", pc && `CP ${pc}`, a.state ?? "", "España"]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  return parts.join(", ");
}

const UA = "plataformadeinversion/1.0 (investment scan; contact: danielhdz4-ai)";

export function normalizeSpanishPostalCode(q: string): string | null {
  const trimmed = q.trim();
  const m = trimmed.match(/^(\d{4,5})$/);
  if (!m) return null;
  return m[1]!.padStart(5, "0");
}

/** CP + texto opcional, p. ej. "08906" o "08906 L'Hospitalet". */
export function extractPostalFromQuery(q: string): { postal: string; rest: string } | null {
  const m = q.trim().match(/^(\d{4,5})(?:\s+(.+))?$/i);
  if (!m) return null;
  return { postal: m[1]!.padStart(5, "0"), rest: (m[2] ?? "").trim() };
}

function inSpain(lng: number, lat: number) {
  return (
    lng >= SPAIN_BBOX.minLng &&
    lng <= SPAIN_BBOX.maxLng &&
    lat >= SPAIN_BBOX.minLat &&
    lat <= SPAIN_BBOX.maxLat
  );
}

function formatLabel(item: NominatimItem, postalHint?: string) {
  const a = item.address;
  if (a) {
    const pc = a.postcode ?? postalHint ?? "";
    const place =
      a.city ?? a.town ?? a.village ?? a.municipality ?? item.display_name.split(",")[0] ?? "";
    const region = a.state ?? "";
    const parts = [pc && `CP ${pc}`, place, region, "España"].filter(Boolean);
    if (parts.length >= 2) return parts.join(", ");
  }
  return item.display_name;
}

function mapItem(item: NominatimItem, postalHint?: string): GeocodeHit {
  return {
    label: formatLabel(item, postalHint),
    lat: Number(item.lat),
    lng: Number(item.lon),
    bbox: item.boundingbox
      ? ([
          Number(item.boundingbox[2]),
          Number(item.boundingbox[0]),
          Number(item.boundingbox[3]),
          Number(item.boundingbox[1]),
        ] as [number, number, number, number])
      : null,
  };
}

function postcodeMatches(item: NominatimItem, postal: string) {
  const pc = item.address?.postcode?.replace(/\s/g, "");
  if (pc && pc.padStart(5, "0") === postal) return true;
  return item.display_name.includes(postal);
}

async function zippopotamPostalHit(postal: string): Promise<GeocodeHit | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/ES/${postal}`, {
      next: { revalidate: 604800 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      places?: { "place name"?: string; latitude?: string; longitude?: string; state?: string }[];
    };
    const place = data.places?.[0];
    if (!place?.latitude || !place.longitude) return null;
    const lat = Number(place.latitude);
    const lng = Number(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inSpain(lng, lat)) return null;
    const name = place["place name"] ?? "España";
    const region = place.state ?? "";
    return {
      label: [`CP ${postal}`, name, region, "España"].filter(Boolean).join(", "),
      lat,
      lng,
      bbox: null,
    };
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function nominatimFetch(params: Record<string, string>) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": UA, "Accept-Language": "es" },
        next: { revalidate: 86400 },
      });
      if (res.ok) return (await res.json()) as NominatimItem[];
      if (res.status === 429 || res.status >= 500) {
        await sleep(350 * (attempt + 1));
        continue;
      }
      return [];
    } catch {
      await sleep(350 * (attempt + 1));
    }
  }
  return [];
}

function queryLooksLikePartialCp(q: string): boolean {
  const t = q.trim();
  return /^\d{1,3}$/.test(t);
}

const ADMIN_SUFFIX = /\b(provincia|province|comunidad|comunitat|autonomous|comunidad autónoma)\b/i;

/** "Chamberí" → "Chamberí, España"; "Gracia, Barcelona" conserva contexto. */
function placeQuery(q: string): string {
  const t = q.trim();
  if (/\bespaña\b|\bspain\b/i.test(t)) return t;
  return `${t}, España`;
}

/** Consulta sin sufijos administrativos (evita "Comunitat Valenciana" como municipio). */
function stripAdminSuffix(q: string): string {
  return q.replace(ADMIN_SUFFIX, "").replace(/\s{2,}/g, " ").trim();
}

/** Si el usuario escribe solo "Barcelona", no devolvemos provincias/CCAA. */
function isBareName(q: string): boolean {
  const words = q.trim().split(/\s+/);
  return words.length <= 2 && !/\d/.test(q);
}

/**
 * Geocode de barrios y municipios (texto libre).
 * Solo lugares (barrio, distrito, municipio, ciudad), nunca calles, estaciones ni comercios.
 */
export async function geocodeSpainPlaces(q: string): Promise<GeocodeHit[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];

  const cached = getCachedGeocodeHits(`place:${trimmed}`) ?? cachedFuzzyHits(`place:${trimmed}`);
  if (cached) return cached;

  /**
   * Con contexto ("Hostafrancs, Barcelona") priorizamos la frase exacta;
   * Nominatim suele devolver antes homónimos de otras provincias.
   */
  const attempts = isBareName(trimmed)
    ? [
        { q: placeQuery(trimmed), limit: "10" },
        { q: `${trimmed} barrio distrito municipio, España`, limit: "8" },
      ]
    : [
        { q: placeQuery(stripAdminSuffix(trimmed)), limit: "6" },
        { q: `${trimmed} barrio OR distrito OR municipio, España`, limit: "10" },
      ];

  const seenLabels = new Set<string>();
  const hits: GeocodeHit[] = [];
  const tokens = trimmed
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((t) => t.length >= 3);

  for (const attempt of attempts) {
    const raw = await nominatimFetch({
      q: attempt.q,
      format: "json",
      addressdetails: "1",
      limit: attempt.limit,
      countrycodes: "es",
      "accept-language": "es",
    });
    for (const item of raw) {
      const hit = isPlaceItem(item) ? mapItem(item) : null;
      if (!hit) continue;
      if (!Number.isFinite(hit.lat) || !Number.isFinite(hit.lng) || !inSpain(hit.lng, hit.lat)) {
        continue;
      }
      const label = isPlaceItem(item)
        ? formatPlaceLabel(item)
        : formatPostalLabel(item);
      if (seenLabels.has(label)) continue;
      hit.label = label;
      seenLabels.add(label);
      hits.push(hit);
    }
  }

  const scored = hits
    .map((h) => {
      const lower = h.label.toLowerCase();
      const matches = tokens.filter((t) => lower.includes(t)).length;
      const nameFirst = lower.startsWith(tokens[0] ?? "\u0000") ? 0 : 1;
      return { h, matches, nameFirst };
    })
    .sort((a, b) => b.matches - a.matches || a.nameFirst - b.nameFirst)
    .map((s) => s.h);

  const out = scored.slice(0, 8);
  if (out.length) setCachedGeocodeHits(`place:${trimmed}`, out);
  else setFuzzyHits(`place:${trimmed}`, []);
  return out;
}

/**
 * CP de una etiqueta de geocode: "CP 46006, Valencia…" o "Chamberí, Madrid, CP 28001".
 * Devuelve null si el resultado es un barrio/municipio sin CP (búsqueda por área).
 */
export function cpFromGeocodeLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const out = /CP\s*(\d{5})/i.exec(label);
  return out?.[1] ?? null;
}

/** CP y etiqueta legible desde coordenadas (Nominatim reverse). */
export async function reverseGeocodeSpain(lat: number, lng: number): Promise<GeocodeHit | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("zoom", "14");
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": UA },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const item = (await res.json()) as NominatimItem;
    if (!item?.lat || !item.lon) return null;
    const pc = item.address?.postcode?.replace(/\s/g, "").slice(0, 5);
    return mapItem(item, pc?.padStart(5, "0"));
  } catch {
    return null;
  }
}

export async function geocodeSpainQuery(q: string): Promise<GeocodeHit[]> {
  const trimmed = q.trim();
  if (queryLooksLikePartialCp(trimmed)) {
    return [];
  }

  const cached = getCachedGeocodeHits(trimmed);
  if (cached?.length) return cached;

  const postalExtract = extractPostalFromQuery(trimmed);
  if (postalExtract) {
    const { postal, rest } = postalExtract;
    const zipCached = getCachedPostalHit(postal);
    if (zipCached && !rest) {
      setCachedGeocodeHits(trimmed, [zipCached]);
      return [zipCached];
    }

    const dbHit = !rest ? await fetchCpCentroidFromDb(postal) : null;
    if (dbHit) {
      setCachedPostalHit(postal, dbHit);
      setCachedGeocodeHits(trimmed, [dbHit]);
      return [dbHit];
    }

    const zipQuick = !rest ? await zippopotamPostalHit(postal) : null;
    if (zipQuick) {
      setCachedPostalHit(postal, zipQuick);
      void upsertCpCentroid(postal, zipQuick, "zippopotam");
      if (!rest) {
        setCachedGeocodeHits(trimmed, [zipQuick]);
        return [zipQuick];
      }
    }

    const structured = await nominatimFetch({
      postalcode: postal,
      country: "Spain",
      countrycodes: "es",
      format: "json",
      addressdetails: "1",
      limit: "12",
    });
    let hits = structured
      .filter((item) => postcodeMatches(item, postal))
      .map((item) => mapItem(item, postal));

    if (rest) {
      const restLower = rest.toLowerCase();
      const narrowed = hits.filter((h) => h.label.toLowerCase().includes(restLower));
      if (narrowed.length > 0) hits = narrowed;
    }

    if (hits.length > 0) {
      const out = hits.filter((r) => inSpain(r.lng, r.lat)).slice(0, 8);
      setCachedGeocodeHits(trimmed, out);
      if (out[0]) void upsertCpCentroid(postal, out[0], "nominatim");
      return out;
    }

    const fallback = await nominatimFetch({
      q: rest ? `${postal} ${rest}, España` : `${postal}, España`,
      format: "json",
      addressdetails: "1",
      limit: "8",
      countrycodes: "es",
    });
    hits = fallback
      .filter((item) => postcodeMatches(item, postal))
      .map((item) => mapItem(item, postal));
    if (hits.length > 0) {
      const out = hits.filter((r) => inSpain(r.lng, r.lat)).slice(0, 8);
      setCachedGeocodeHits(trimmed, out);
      return out;
    }

    const zipHit = zipQuick ?? (await zippopotamPostalHit(postal));
    if (zipHit) {
      setCachedPostalHit(postal, zipHit);
      void upsertCpCentroid(postal, zipHit, "zippopotam");
      setCachedGeocodeHits(trimmed, [zipHit]);
      return [zipHit];
    }
  }

  if (/^\d+$/.test(trimmed)) {
    return [];
  }

  const places = await geocodeSpainPlaces(trimmed);
  if (places.length) {
    setCachedGeocodeHits(trimmed, places);
    return places;
  }

  const raw = await nominatimFetch({
    q: placeQuery(stripAdminSuffix(trimmed)),
    format: "json",
    addressdetails: "1",
    limit: "10",
    countrycodes: "es",
    "accept-language": "es",
  });

  const qLower = trimmed.toLowerCase();
  const out = raw
    .map((item) => mapItem(item))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && inSpain(r.lng, r.lat))
    .sort((a, b) => {
      const aMatch = a.label.toLowerCase().includes(qLower) ? 0 : 1;
      const bMatch = b.label.toLowerCase().includes(qLower) ? 0 : 1;
      return aMatch - bMatch;
    })
    .slice(0, 8);
  if (out.length) setCachedGeocodeHits(trimmed, out);
  return out;
}
