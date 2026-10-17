export type RentComparable = {
  id: string;
  title: string | null;
  price: number;
  sqm: number | null;
  bedrooms: number | null;
  distanceM: number;
};

import type { NotaryPortalStats } from "@/lib/notariado/types";

export type ListingSummary = {
  listingId: string;
  postalCode: string | null;
  pricePerSqm: number | null;
  roi: {
    rentEstMonthly: number | null;
    purchasePrice: number;
    purchaseTaxPct: number;
    purchaseTaxAmount: number;
    totalCashInvested: number;
    grossRoiPct: number | null;
    rentConfidence: string | null;
    comparablesCount: number;
  };
  comparables: RentComparable[];
  notary: {
    priceM2: number | null;
    avgPrice: number | null;
    avgSurface: number | null;
    operationsCount: number | null;
    period: string | null;
    esEstimado: boolean;
    portal: NotaryPortalStats | null;
  } | null;
  neighborhood: {
    listingPriceM2: number | null;
    cpAvgPriceM2: number | null;
    vsCpPct: number | null;
  };
  officialMarket: { source: string; period: string; metrics: Record<string, unknown> }[];
  priceEvolution: {
    saleM2: { x: string; y: number }[];
    rentM2: { x: string; y: number }[];
    saleChangePct: number;
    rentChangePct: number;
  };
  demographics: { note: string };
  localDevelopments: {
    title: string;
    category: string;
    year: string;
    description: string;
  }[];
  nearbyPlaces: { note: string };
};
