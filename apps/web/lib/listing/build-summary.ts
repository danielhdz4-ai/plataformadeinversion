import type { ListingSummary, RentComparable } from "@/lib/listing/summary-types";
import { portalFromNotaryRaw } from "@/lib/notariado/normalize-portal";

import { DEFAULT_ITP_PCT } from "@/lib/listing/tax-itp";

/** Serie indicativa Barcelona (venta/alquiler €/m²) — alineada con fuentes oficiales en UI. */
function buildPriceEvolution(cpAvgM2: number | null) {
  const saleEnd = cpAvgM2 ?? 3398;
  const rentEnd = 19;
  const saleStart = saleEnd / 1.284;
  const rentStart = rentEnd / 1.43;
  const labels = ["sept 21", "mar 23", "sept 24", "mar 26"];
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const saleM2 = labels.map((x, i) => ({
    x,
    y: lerp(saleStart, saleEnd, i / (labels.length - 1)),
  }));
  const rentM2 = labels.map((x, i) => ({
    x,
    y: lerp(rentStart, rentEnd, i / (labels.length - 1)),
  }));
  return { saleM2, rentM2, saleChangePct: 28.4, rentChangePct: 43.0 };
}

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
  itpPct: number = DEFAULT_ITP_PCT
): ListingSummary {
  const inv = row.listing_investment;
  const rent = inv?.rent_est ?? null;
  const price = Number(row.price);
  const purchaseTaxAmount = price * (itpPct / 100);
  const totalCashInvested = price + purchaseTaxAmount;
  const grossRoiPct =
    inv?.roi_gross ??
    (rent && totalCashInvested > 0 ? ((rent * 12) / totalCashInvested) * 100 : null);

  const listingPriceM2 = row.sqm && row.sqm > 0 ? price / row.sqm : null;
  const cpAvg = notary?.price_m2 != null ? Number(notary.price_m2) : null;
  const vsCpPct =
    listingPriceM2 != null && cpAvg != null && cpAvg > 0
      ? ((listingPriceM2 - cpAvg) / cpAvg) * 100
      : null;

  return {
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
    notary: notary
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
      : null,
    neighborhood: {
      listingPriceM2,
      cpAvgPriceM2: cpAvg,
      vsCpPct,
    },
    officialMarket,
    priceEvolution: buildPriceEvolution(cpAvg),
    demographics: {
      note: "Datos de sección censal (INE) — sincronización en roadmap. Usa mercado notarial del CP como proxy.",
    },
    localDevelopments: notary?.price_m2 != null ? [] : [...BARCELONA_DEVELOPMENTS],
    nearbyPlaces: {
      note: "Mapa de POIs (educación, transporte, salud) — próxima iteración con OSM.",
    },
  };
}
