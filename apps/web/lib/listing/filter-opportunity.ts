import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";
import type { OpportunityMetrics } from "@/lib/listing/opportunity-metrics";
import type { SellerKind } from "@/lib/listing/seller-kind";

export function listingMatchesOpportunityFilters(
  metrics: OpportunityMetrics | null | undefined,
  filters: ScanRunFilters,
  opts?: { strictScore?: boolean; strictDiscount?: boolean }
): boolean {
  const kinds = filters.sellerKinds;
  if (kinds?.length) {
    const k = metrics?.sellerKind ?? "unknown";
    if (!kinds.includes(k)) return false;
  }

  const minDisc = filters.minDiscountPct ?? 0;
  if (minDisc > 0) {
    const d = metrics?.discountPct;
    if (d == null) return opts?.strictDiscount ? false : true;
    if (d < minDisc) return false;
  }

  const minScore = filters.minOpportunityScore ?? 0;
  if (minScore > 0) {
    const s = metrics?.opportunityScore;
    if (s == null) return opts?.strictScore ? false : true;
    if (s < minScore) return false;
  }

  const maxAge = filters.maxScrapedAgeDays;
  if (maxAge != null && maxAge > 0) {
    const age = metrics?.scrapedAgeDays;
    if (age != null && age > maxAge) return false;
  }

  return true;
}

export const ALL_SELLER_KINDS: SellerKind[] = ["bank", "agency", "private", "auction"];
