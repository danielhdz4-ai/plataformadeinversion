import { computeOpportunityMetrics } from "@/lib/listing/opportunity-metrics";
import { listingMatchesOpportunityFilters } from "@/lib/listing/filter-opportunity";
import type { ListingSummary } from "@/lib/listing/summary-types";
import { filterListings } from "@/lib/scan/apply-scan-filters";
import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";
import { sortListingRows } from "@/lib/listing/sort-listings";
import type { ListingSort } from "@/components/filters/ListingFiltersPanel";

export type ViewListingRow = {
  id: string;
  price: number;
  roi?: number | null;
  sqm?: number | null;
  source_portal?: string | null;
  source?: string | null;
  title?: string | null;
  sourceUrl?: string | null;
  scrapedAt?: string | null;
  rentConfidence?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
};

export function applyListingViewPipeline<T extends ViewListingRow>(
  rows: T[],
  filters: ScanRunFilters,
  sort: ListingSort,
  summaries: Record<string, ListingSummary | null | undefined>
): T[] {
  const base = filterListings(
    rows.map((r) => ({
      ...r,
      source_portal: r.source_portal ?? r.source,
    })),
    filters
  );

  const withOpp = base.filter((row) => {
    const summary = summaries[row.id];
    const metrics =
      summary?.opportunity ??
      computeOpportunityMetrics(
        {
          price: row.price,
          sqm: row.sqm,
          roi: row.roi,
          sourcePortal: row.source_portal ?? row.source,
          title: row.title,
          sourceUrl: row.sourceUrl,
          scrapedAt: row.scrapedAt,
          rentConfidence: row.rentConfidence,
        },
        summary
      );
    const strict =
      (filters.minDiscountPct ?? 0) > 0 ||
      (filters.minOpportunityScore ?? 0) > 0 ||
      (filters.sellerKinds?.length ?? 0) > 0 ||
      (filters.maxScrapedAgeDays ?? 0) > 0;
    return listingMatchesOpportunityFilters(metrics, filters, {
      strictDiscount: strict,
      strictScore: strict,
    });
  });

  return sortListingRows(withOpp, sort, summaries);
}
