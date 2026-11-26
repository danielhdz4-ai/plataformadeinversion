import { resolveListingGrossRoiPct } from "@/lib/listing/gross-roi";
import { computeOpportunityMetrics } from "@/lib/listing/opportunity-metrics";
import { resolveRentEstMonthly } from "@/lib/listing/rent-est";
import type { ListingSummary, RentComparable } from "@/lib/listing/summary-types";
import { portalFromNotaryRaw } from "@/lib/notariado/normalize-portal";

import type { ListingCensusSection } from "@/lib/listing/census-types";
import { DEFAULT_ITP_PCT } from "@/lib/listing/tax-itp";

import { buildPriceEvolutionFromNotary } from "@/lib/listing/price-evolution-from-notary";

/** Desarrollos de referencia Barcelona área metropolitana (roadmap datos en vivo). */
export const BARCELONA_DEVELOPMENTS = [
  {
    title: "Ampliación L9 metro Barcelona",
    category: "Infraestructura",
    year: "2026",
    description: "Mejora de conectividad en área metropolitana.",
  },
  {
    title: "Estación La Sagrera",
    category: "Infraestructura",
    year: "2026",
    description: "Nodo ferroviario — demanda de vivienda en corredor.",
  },
  {
    title: "Parque empresarial 22@",
    category: "Empresarial",
    year: "2026",
    description: "Talento y demanda de alquiler en Barcelona.",
  },
] as const;

type ListingRow = {
  id: string;
  price: number;
  sqm: number | null;
  postal_code: string | null;
  ccaa?: string | null;
  source_portal?: string | null;
  title?: string | null;
  source_url?: string | null;
  scraped_at?: string | null;
  listing_investment?: {
    rent_est: number | null;
    roi_gross: number | null;
    rent_confidence: string | null;
    comparables_count: number;
  } | null;
};

export function buildListingSummary(
  row: ListingRow,
  comparables: RentComparable[],
  notary: Record<string, unknown> | null,
  officialMarket: { source: string; period: string; metrics: Record<string, unknown> }[],
  itpPct: number = DEFAULT_ITP_PCT,
  census: ListingCensusSection | null = null
): ListingSummary {
  const inv = row.listing_investment;
  const price = Number(row.price);
  const rent = resolveRentEstMonthly(price, inv?.rent_est ?? null);
  const purchaseTaxAmount = price * (itpPct / 100);
  const totalCashInvested = price + purchaseTaxAmount;
  const grossRoiPct = resolveListingGrossRoiPct(price, rent, inv?.roi_gross ?? null);

  const listingPriceM2 = row.sqm && row.sqm > 0 ? price / row.sqm : null;
  const cpAvg = notary?.price_m2 != null ? Number(notary.price_m2) : null;
  const vsCpPct =
    listingPriceM2 != null && cpAvg != null && cpAvg > 0
      ? ((listingPriceM2 - cpAvg) / cpAvg) * 100
      : null;

  const notarySummary = notary
    ? {
        priceM2: notary.price_m2 != null ? Number(notary.price_m2) : null,
        avgPrice: notary.avg_price != null ? Number(notary.avg_price) : null,
        avgSurface: notary.avg_surface != null ? Number(notary.avg_surface) : null,
        operationsCount:
          notary.operations_count != null ? Number(notary.operations_count) : null,
        period: (notary.period as string) ?? null,
        esEstimado: Boolean(notary.es_estimado),
        portal: portalFromNotaryRaw(notary.raw ?? null),
      }
    : null;

  const draft: Omit<ListingSummary, "opportunity"> = {
    listingId: row.id,
    postalCode: row.postal_code,
    pricePerSqm: listingPriceM2,
    roi: {
      rentEstMonthly: rent,
      purchasePrice: price,
      purchaseTaxPct: itpPct,
      purchaseTaxAmount,
      totalCashInvested,
      grossRoiPct,
      rentConfidence: inv?.rent_confidence ?? null,
      comparablesCount: inv?.comparables_count ?? comparables.length,
    },
    comparables,
    notary: notarySummary,
    neighborhood: {
      listingPriceM2,
      cpAvgPriceM2: cpAvg,
      vsCpPct,
    },
    officialMarket,
    priceEvolution: buildPriceEvolutionFromNotary(cpAvg, notarySummary),
    demographics: census ?? {
      note: "Sin sección censal INE para este punto. Usa mercado notarial del CP como proxy.",
    },
    localDevelopments: [],
    nearbyPlaces: {
      note: "Mapa de POIs (educación, transporte, salud) — próxima iteración con OSM.",
    },
  };

  const opportunity = computeOpportunityMetrics(
    {
      price,
      sqm: row.sqm,
      roi: grossRoiPct,
      sourcePortal: row.source_portal,
      title: row.title,
      sourceUrl: row.source_url,
      scrapedAt: row.scraped_at,
      rentConfidence: inv?.rent_confidence ?? null,
    },
    draft as ListingSummary
  );

  return { ...draft, opportunity };
}
