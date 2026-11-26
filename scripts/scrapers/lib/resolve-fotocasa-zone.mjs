import { FOTOCASA_SALE_ZONES } from "./fotocasa-api.mjs";
import { getCityConfig } from "./spain-city.mjs";

/** Capital / provincia conocida en catálogo Fotocasa (URL 200). */
const CITY_TO_FOTOCASA = {
  barcelona: "barcelona-capital",
  madrid: "madrid-capital",
  "madrid-metro": "madrid-provincia",
  valencia: "valencia-capital",
  sevilla: "sevilla-capital",
  malaga: "malaga-capital",
  bilbao: "bilbao",
  zaragoza: "zaragoza-capital",
  alicante: "alicante-alacant",
  murcia: "murcia-capital",
  palma: "palma-de-mallorca",
  "las-palmas": "las-palmas-de-gran-canaria",
  "a-coruna": "a-coruna",
  girona: "girona",
  granada: "granada-capital",
  cadiz: "cadiz",
  cordoba: "cordoba",
  valladolid: "valladolid",
  pamplona: "pamplona",
  santander: "santander",
  oviedo: "oviedo",
  gijon: "gijon",
  toledo: "toledo",
  salamanca: "salamanca",
  burgos: "burgos",
  almeria: "almeria-capital",
  castellon: "castellon-provincia",
  "vitoria-gasteiz": "vitoria-gasteiz",
  "san-sebastian": "gipuzkoa",
  pamplona: "navarra-provincia",
  logrono: "logrono",
  huelva: "huelva-provincia",
  vitoria: "vitoria-gasteiz",
};

const KNOWN_ZONE_SLUGS = new Set(FOTOCASA_SALE_ZONES.map((z) => z.slug));

/** Slug Fotocasa para ingestión (ciudad Tier 1/2 España). */
export function resolveFotocasaZoneSlug(citySlug) {
  if (!citySlug) return null;
  const mapped = CITY_TO_FOTOCASA[citySlug];
  if (mapped) return mapped;

  const provincia = `${citySlug}-provincia`;
  if (KNOWN_ZONE_SLUGS.has(provincia)) return provincia;

  try {
    const city = getCityConfig(citySlug);
    const pisos = city.pisosSlug ?? citySlug;
    const fromPisos = `${pisos}-provincia`;
    if (fromPisos !== provincia && KNOWN_ZONE_SLUGS.has(fromPisos)) return fromPisos;
  } catch {
    /* unknown slug */
  }

  if (KNOWN_ZONE_SLUGS.has(provincia)) return provincia;
  return provincia;
}

export function fotocasaZoneMeta(citySlug) {
  const slug = resolveFotocasaZoneSlug(citySlug);
  if (!slug) return null;
  try {
    const city = getCityConfig(citySlug);
    const [minLng, minLat, maxLng, maxLat] = city.bbox;
    return {
      slug,
      name: city.name,
      ccaa: city.ccaa,
      lat: (minLat + maxLat) / 2,
      lng: (minLng + maxLng) / 2,
      bbox: city.bbox,
    };
  } catch {
    return { slug, name: citySlug, ccaa: null, lat: null, lng: null, bbox: null };
  }
}
