/**
 * Origen del anuncio respecto a la frescura del scrape.
 *
 * Transparencia: el usuario debe saber si lo que ve viene de una importación
 * recién hecha o de lo último que hay en base de datos para esa zona.
 */
export type ListingOrigin = "live" | "cache" | "stale";

export const LISTING_ORIGIN_LABEL: Record<ListingOrigin, string> = {
  live: "recién importado",
  cache: "última importación",
  stale: "dato antiguo",
};

export const LISTING_ORIGIN_CLASS: Record<ListingOrigin, string> = {
  live: "bg-emerald-100 text-emerald-950",
  cache: "bg-neutral-100 text-neutral-700",
  stale: "bg-amber-100 text-amber-950",
};

/** ≤2 días = recién importado · ≤14 días = última importación · resto = antiguo. */
export function listingOrigin(
  scrapedAt: string | null | undefined,
  now: number = Date.now()
): ListingOrigin {
  if (!scrapedAt) return "stale";
  const t = Date.parse(scrapedAt);
  if (!Number.isFinite(t)) return "stale";
  const days = (now - t) / 86400000;
  if (days <= 2) return "live";
  if (days <= 14) return "cache";
  return "stale";
}
