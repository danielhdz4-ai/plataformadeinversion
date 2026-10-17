/** Informe tipo PDF del Portal Estadístico del Notariado (penotariado.com). */
export type NotaryPortalStats = {
  source: "penotariado";
  postalCode: string;
  placeName?: string | null;
  reportDate: string;
  periodFrom: string;
  periodTo: string;
  filters: {
    propertyType: string;
    constructionType: string;
  };
  summary: {
    priceM2: number;
    salesCount: number;
    avgAmount: number;
    avgSurface: number;
  };
  monthly: {
    labels: string[];
    priceM2: number[];
    salesCount: number[];
    avgAmount: number[];
  };
  additional?: {
    priceChangePct12m: number | null;
    priceChangeByYear: { year: number; pct: number }[];
    medianPriceM2: number | null;
    medianByYear: { year: number; priceM2: number }[];
    newBuildPct: number | null;
    secondHandPct: number | null;
    housesPct: number | null;
    flatsPct: number | null;
  };
  sociodemographic?: {
    buyerAgeDistribution: { band: string; pct: number }[];
    medianBuyerAge: number | null;
    medianBuyerAgeByYear: { year: number; age: number }[];
    naturalPersonsPct: number | null;
    legalEntitiesPct: number | null;
    nationalBuyersPct: number | null;
    foreignBuyersPct: number | null;
    foreignByNationality: { country: string; residentsPct: number; nonResidentsPct: number; totalPct: number }[];
  };
  sourceUrl: string;
};

export type NotaryStatsRow = {
  postal_code: string;
  period: string;
  price_m2: number | null;
  avg_price: number | null;
  avg_surface: number | null;
  operations_count: number | null;
  es_estimado: boolean;
  source_url: string | null;
  raw: unknown;
};
