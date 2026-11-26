import type { ListingSort } from "@/components/filters/ListingFiltersPanel";

import type { ListingSummary } from "@/lib/listing/summary-types";

import { computeOpportunityMetrics, type OpportunityListingInput } from "@/lib/listing/opportunity-metrics";



export function sortListingRows<T extends { price: number; roi?: number | null; sqm?: number | null; id?: string }>(

  rows: T[],

  sort: ListingSort,

  summaries?: Record<string, ListingSummary | null | undefined>

): T[] {

  const copy = [...rows];

  const metricsFor = (row: T) => {

    const id = row.id;

    const summary = id ? summaries?.[id] : undefined;

    if (summary?.opportunity) return summary.opportunity;

    return computeOpportunityMetrics(row as OpportunityListingInput, summary ?? null);

  };



  switch (sort) {

    case "price_asc":

      return copy.sort((a, b) => a.price - b.price);

    case "price_desc":

      return copy.sort((a, b) => b.price - a.price);

    case "sqm_desc":

      return copy.sort((a, b) => (b.sqm ?? 0) - (a.sqm ?? 0));

    case "score_desc":

      return copy.sort(

        (a, b) => (metricsFor(b).opportunityScore ?? -1) - (metricsFor(a).opportunityScore ?? -1)

      );

    case "discount_desc":

      return copy.sort(

        (a, b) => (metricsFor(b).discountPct ?? -999) - (metricsFor(a).discountPct ?? -999)

      );

    case "roi_desc":

    default:

      return copy.sort((a, b) => (b.roi ?? -1) - (a.roi ?? -1));

  }

}

