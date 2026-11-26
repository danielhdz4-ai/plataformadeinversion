import { classifySellerKind, type SellerKind } from "@/lib/listing/seller-kind";
import type { ListingSummary } from "@/lib/listing/summary-types";

export type ValuationConfidence = "high" | "medium" | "low";

export type OpportunityMetrics = {
  sellerKind: SellerKind;
  valuationMid: number | null;
  valuationLow: number | null;
  valuationHigh: number | null;
  /** Positivo = precio por debajo de la valoración orientativa (%) */
  discountPct: number | null;
  opportunityScore: number | null;
  valuationConfidence: ValuationConfidence;
  scrapedAgeDays: number | null;
};

export type OpportunityListingInput = {
  price: number;
  sqm?: number | null;
  roi?: number | null;
  sourcePortal?: string | null;
  title?: string | null;
  sourceUrl?: string | null;
  scrapedAt?: string | null;
  rentConfidence?: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function scrapedAgeDays(scrapedAt: string | null | undefined): number | null {
  if (!scrapedAt) return null;
  const t = Date.parse(scrapedAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / (86400 * 1000)));
}

/** Valoración orientativa a partir de notariado / €/m² del CP. */export function resolveValuation(input: {
  price: number;
  sqm: number | null;
  summary: ListingSummary | null | undefined;
}): Pick<
  OpportunityMetrics,
  "valuationMid" | "valuationLow" | "valuationHigh" | "discountPct" | "valuationConfidence"
> {
  const { price, sqm, summary } = input;
  const notary = summary?.notary;
  const cpM2 = summary?.neighborhood.cpAvgPriceM2 ?? notary?.priceM2 ?? null;

  let valuationMid: number | null = null;
  let confidence: ValuationConfidence = "low";

  if (notary?.avgPrice != null && notary.avgPrice > 0 && sqm != null && notary.avgSurface != null && notary.avgSurface > 0) {
    valuationMid = notary.avgPrice * (sqm / notary.avgSurface);
    confidence = notary.esEstimado ? "medium" : "high";
  } else if (cpM2 != null && sqm != null && sqm > 0) {
    valuationMid = cpM2 * sqm;
    confidence = notary?.operationsCount != null && notary.operationsCount >= 20 ? "medium" : "low";
  } else if (cpM2 != null && summary?.notary?.avgPrice != null) {
    valuationMid = Number(summary.notary.avgPrice);
    confidence = "low";
  }

  if (valuationMid == null || !Number.isFinite(valuationMid) || valuationMid <= 0) {
    return {
      valuationMid: null,
      valuationLow: null,
      valuationHigh: null,
      discountPct: null,
      valuationConfidence: "low",
    };
  }

  const discountPct = ((valuationMid - price) / valuationMid) * 100;

  /** CP notarial ausente o m² dudosos → descuentos >30 % suelen ser artefacto. */
  if (confidence === "low" && (discountPct > 28 || valuationMid > price * 1.75)) {
    return {
      valuationMid: null,
      valuationLow: null,
      valuationHigh: null,
      discountPct: null,
      valuationConfidence: "low",
    };
  }
  if (confidence !== "high" && discountPct > 42) {
    return {
      valuationMid: null,
      valuationLow: null,
      valuationHigh: null,
      discountPct: null,
      valuationConfidence: confidence,
    };
  }

  const spread = confidence === "high" ? 0.12 : confidence === "medium" ? 0.18 : 0.22;
  const valuationLow = valuationMid * (1 - spread);
  const valuationHigh = valuationMid * (1 + spread);

  return {
    valuationMid: Math.round(valuationMid),
    valuationLow: Math.round(valuationLow),
    valuationHigh: Math.round(valuationHigh),
    discountPct: Math.round(discountPct * 10) / 10,
    valuationConfidence: confidence,
  };
}

export function computeOpportunityScore(parts: {
  discountPct: number | null;
  grossRoiPct: number | null;
  vsCpPct: number | null;
  scrapedAgeDays: number | null;
  rentConfidence: string | null;
}): number | null {
  let score = 0;
  let hasSignal = false;

  if (parts.discountPct != null) {
    hasSignal = true;
    score += clamp(parts.discountPct, -15, 35) * 1.1;
  }
  if (parts.grossRoiPct != null && parts.grossRoiPct > 0) {
    hasSignal = true;
    score += clamp(parts.grossRoiPct, 0, 18) * 2.2;
  }
  if (parts.vsCpPct != null && parts.vsCpPct < 0) {
    hasSignal = true;
    score += clamp(-parts.vsCpPct, 0, 25) * 0.8;
  }
  if (parts.scrapedAgeDays != null) {
    hasSignal = true;
    if (parts.scrapedAgeDays <= 7) score += 12;
    else if (parts.scrapedAgeDays <= 21) score += 6;
    else if (parts.scrapedAgeDays <= 45) score += 1;
    else if (parts.scrapedAgeDays <= 90) score -= 8;
    else if (parts.scrapedAgeDays <= 180) score -= 14;
    else score -= 22;
  }
  const conf = String(parts.rentConfidence ?? "").toLowerCase();
  if (conf === "high") score += 8;
  else if (conf === "medium") score += 4;

  if (!hasSignal) return null;
  return clamp(Math.round(score), 0, 100);
}

export function computeOpportunityMetrics(
  listing: OpportunityListingInput,
  summary?: ListingSummary | null
): OpportunityMetrics {
  const sqm = listing.sqm ?? null;
  const val = resolveValuation({ price: listing.price, sqm, summary });
  const grossRoi = summary?.roi.grossRoiPct ?? listing.roi ?? null;
  const age = scrapedAgeDays(listing.scrapedAt);
  const opportunityScore = computeOpportunityScore({
    discountPct: val.discountPct,
    grossRoiPct: grossRoi,
    vsCpPct: summary?.neighborhood.vsCpPct ?? null,
    scrapedAgeDays: age,
    rentConfidence: summary?.roi.rentConfidence ?? listing.rentConfidence ?? null,
  });

  return {
    sellerKind: classifySellerKind(listing),
    ...val,
    opportunityScore,
    scrapedAgeDays: age,
  };
}

export function formatScrapedAgeEs(days: number | null): string | null {
  if (days == null) return null;
  if (days === 0) return "hoy";
  if (days === 1) return "hace 1 d";
  if (days < 60) return `hace ${days} d`;
  const months = Math.round(days / 30);
  return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
}
