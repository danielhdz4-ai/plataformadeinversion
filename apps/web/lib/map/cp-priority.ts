import { cpRadiusSteps } from "@/lib/map/cp-zone-stock";

/** CP rurales / auditoría con stock bajo — scrape y tag más agresivos. */
export const RURAL_CP_PRIORITY = new Set([
  "05267",
  "39680",
  "18411",
  "21200",
  "25126",
  "42146",
  "09560",
  "15886",
  "15300",
  "40542",
  "50630",
  "24540",
  "47460",
  "09340",
  "44240",
]);

/** Capitales que en auditoría salen con 0 fresco sin re-scrape reciente. */
export const CP_STOCK_GAP_WATCH = new Set(["01001", "20001", "26001", "31001", "21001"]);

/**
 * CP de la ciudad de Madrid (280xx). El portal cubre el municipio entero, así que
 * re-scrapear solo un CP deja al resto con stock viejo: se refresca Madrid completo.
 */
export function isMadridCityCp(cp: string | null | undefined): boolean {
  return Boolean(cp) && cp!.length === 5 && cp!.startsWith("280");
}

export function isAggressiveCpStock(cp: string | null | undefined): boolean {
  if (!cp || cp.length !== 5) return false;
  return isMadridCityCp(cp) || RURAL_CP_PRIORITY.has(cp) || CP_STOCK_GAP_WATCH.has(cp);
}

export function cpStockBaseRadiusM(cp: string | null | undefined, defaultM = 5500): number {
  if (isMadridCityCp(cp)) return 8000;
  if (isAggressiveCpStock(cp)) return 9000;
  return defaultM;
}

/**
 * Radio del área a cargar al entrar en un CP.
 * Madrid (~604 km²): 6,5 km solo cubre el centro (28031 quedaba fuera con 131 anuncios).
 */
export function cpFeedInitialRadiusM(cp: string | null | undefined, defaultM = 6500): number {
  return isMadridCityCp(cp) ? 12_000 : defaultM;
}

/** Radios para tag_listings_postal_code tras importación. */
export function cpTagRadiusSteps(cp: string | null | undefined): number[] {
  const base = isMadridCityCp(cp) || isAggressiveCpStock(cp) ? 5500 : 2800;
  return cpRadiusSteps(base);
}
