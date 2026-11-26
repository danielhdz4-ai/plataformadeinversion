import { classifySellerKind } from "@/lib/listing/seller-kind";
import type { OpportunityMetrics } from "@/lib/listing/opportunity-metrics";
import type { ListingSummary } from "@/lib/listing/summary-types";
import { DEFAULT_ITP_PCT } from "@/lib/listing/tax-itp";
import { resolveListingGrossRoiPct } from "@/lib/listing/gross-roi";
import { resolveRentEstMonthly } from "@/lib/listing/rent-est";

export type StoredOpportunityListing = {
  id: string;
  price: number;
  sqm?: number | null;
  title?: string | null;
  postal_code?: string | null;
  city?: string | null;
  source_portal?: string | null;
  source_url?: string | null;
  scraped_at?: string | null;
  is_opportunity?: boolean;
  opportunity_score?: number | null;
  opportunity_discount_pct?: number | null;
  opportunity_valuation_mid?: number | null;
  listing_investment?:
    | { rent_est?: number | null; roi_gross?: number | null; rent_confidence?: string | null }
    | null;
};

function scrapedAgeDays(scrapedAt: string | null | undefined): number | null {
  if (!scrapedAt) return null;
  const t = Date.parse(scrapedAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

export function opportunityMetricsFromStored(row: StoredOpportunityListing): OpportunityMetrics {
  const spread = 0.18;
  const mid = row.opportunity_valuation_mid != null ? Number(row.opportunity_valuation_mid) : null;
  return {
    sellerKind: classifySellerKind({
      sourcePortal: row.source_portal,
      title: row.title,
      sourceUrl: row.source_url,
    }),
    valuationMid: mid,
    valuationLow: mid != null ? Math.round(mid * (1 - spread)) : null,
    valuationHigh: mid != null ? Math.round(mid * (1 + spread)) : null,
    discountPct:
      row.opportunity_discount_pct != null ? Number(row.opportunity_discount_pct) : null,
    opportunityScore:
      row.opportunity_score != null ? Number(row.opportunity_score) : null,
    valuationConfidence: mid != null ? "medium" : "low",
    scrapedAgeDays: scrapedAgeDays(row.scraped_at),
  };
}

/** Resumen mínimo para tarjetas cuando el job ya persistió métricas. */
export function summaryFromStoredOpportunity(row: StoredOpportunityListing): ListingSummary {
  const price = Number(row.price);
  const inv = row.listing_investment;
  const rent = resolveRentEstMonthly(price, inv?.rent_est ?? null);
  const grossRoi = resolveListingGrossRoiPct(price, rent, inv?.roi_gross ?? null);
  const opportunity = opportunityMetricsFromStored(row);

  return {
    listingId: row.id,
    postalCode: row.postal_code ?? null,
    pricePerSqm: row.sqm && row.sqm > 0 ? price / row.sqm : null,
    roi: {
      rentEstMonthly: rent,
      purchasePrice: price,
      purchaseTaxPct: DEFAULT_ITP_PCT,
      purchaseTaxAmount: price * (DEFAULT_ITP_PCT / 100),
      totalCashInvested: price * (1 + DEFAULT_ITP_PCT / 100),
      grossRoiPct: grossRoi,
      rentConfidence: inv?.rent_confidence ?? null,
      comparablesCount: 0,
    },
    comparables: [],
    notary: null,
    neighborhood: { listingPriceM2: null, cpAvgPriceM2: null, vsCpPct: null },
    officialMarket: [],
    priceEvolution: { saleM2: [], rentM2: [], saleChangePct: 0, rentChangePct: 0 },
    demographics: { note: "Demografía INE al abrir ficha completa." },
    localDevelopments: [],
    nearbyPlaces: { note: "" },
    opportunity,
  };
}
