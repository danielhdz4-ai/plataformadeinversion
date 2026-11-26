export type ListingCensusSection = {
  cusec: string;
  sectionName: string | null;
  metricsYear: number | null;
  sourceUrl: string | null;
  population: number | null;
  meanNetIncomeEur: number | null;
  tertiaryEducationPct: number | null;
  unemploymentPct: number | null;
};

export function parseCensusRpcRow(row: Record<string, unknown> | null): ListingCensusSection | null {
  if (!row?.cusec) return null;
  const metrics = (row.metrics ?? {}) as Record<string, unknown>;
  return {
    cusec: String(row.cusec),
    sectionName: (row.section_name as string) ?? null,
    metricsYear: row.metrics_year != null ? Number(row.metrics_year) : null,
    sourceUrl: (row.source_url as string) ?? null,
    population: metrics.population != null ? Number(metrics.population) : null,
    meanNetIncomeEur:
      metrics.mean_net_income_eur != null ? Number(metrics.mean_net_income_eur) : null,
    tertiaryEducationPct:
      metrics.tertiary_education_pct != null ? Number(metrics.tertiary_education_pct) : null,
    unemploymentPct:
      metrics.unemployment_pct != null ? Number(metrics.unemployment_pct) : null,
  };
}
