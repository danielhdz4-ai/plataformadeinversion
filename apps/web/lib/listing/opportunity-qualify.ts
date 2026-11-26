import type { OpportunityMetrics } from "@/lib/listing/opportunity-metrics";

/** Criterios para marcar un inmueble como «oportunidad» en el feed nacional. */
export function qualifiesAsOpportunity(
  metrics: OpportunityMetrics,
  grossRoiPct?: number | null,
  price?: number | null
): boolean {
  const score = metrics.opportunityScore;
  const disc = metrics.discountPct;
  const roi = grossRoiPct ?? null;
  const p = price != null && Number.isFinite(price) ? price : null;

  const valConf = metrics.valuationConfidence ?? "low";

  if (score != null && score >= 58) return true;
  if (disc != null && disc >= 15 && valConf !== "low") return true;
  if (disc != null && disc >= 8 && valConf !== "low" && roi != null && roi >= 7) return true;
  if (metrics.sellerKind === "bank" && disc != null && disc >= 6) return true;
  if (metrics.sellerKind === "auction" && disc != null && disc >= 10) return true;
  if (roi != null && roi >= 12 && (disc == null || disc >= 0)) return true;

  /** Entrada accesible con rentabilidad razonable (aunque la valoración notarial sea débil). */
  if (p != null && p <= 60_000 && roi != null && roi >= 5.5) return true;
  if (p != null && p <= 80_000 && roi != null && roi >= 6.5) {
    if (disc != null && disc >= 4) return true;
    if (score != null && score >= 50) return true;
    if (metrics.sellerKind === "bank" && roi >= 5.5) return true;
  }

  return false;
}

/** Señales rápidas cuando aún no hay valoración (precarga de candidatos). */
export function quickOpportunityCandidate(input: {
  roiGross?: number | null;
  sourcePortal?: string | null;
  price?: number;
}): boolean {
  const roi = input.roiGross ?? 0;
  const portal = (input.sourcePortal ?? "").toLowerCase();
  if (roi >= 9) return true;
  if ((portal === "hipoges" || portal === "solvia") && roi >= 5) return true;
  if (input.price != null && input.price <= 80_000 && roi >= 6) return true;
  return false;
}

export const OPPORTUNITY_FEED_DEFAULTS = {
  minScore: 55,
  minDiscountPct: 5,
  minRoiGross: 0,
  /** Feeds automáticos: sin inventario nacional envejecido. */
  maxScrapedAgeDays: 14,
} as const;

export function listingWithinFreshWindow(
  scrapedAt: string | null | undefined,
  maxDays: number = OPPORTUNITY_FEED_DEFAULTS.maxScrapedAgeDays
): boolean {
  if (!scrapedAt) return false;
  const t = Date.parse(scrapedAt);
  if (!Number.isFinite(t)) return false;
  const age = Math.floor((Date.now() - t) / 86400000);
  return age <= maxDays;
}
