import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";

export function normalizeScanFilters(raw: Record<string, unknown> | undefined): ScanRunFilters {
  const f = raw ?? {};
  return {
    priceMin: f.priceMin != null ? Number(f.priceMin) : 0,
    priceMax: f.priceMax != null ? Number(f.priceMax) : 999_999_999,
    bedroomsMin: f.bedroomsMin != null ? Number(f.bedroomsMin) : undefined,
    allowedBedrooms: Array.isArray(f.allowedBedrooms)
      ? f.allowedBedrooms.map((n) => Number(n))
      : undefined,
    bedroomsMinPlus:
      f.bedroomsMinPlus != null && f.bedroomsMinPlus !== ""
        ? Number(f.bedroomsMinPlus)
        : null,
  };
}

export function listingMatchesBedroomFilter(
  bedrooms: number | null | undefined,
  filters: ScanRunFilters
): boolean {
  const b = bedrooms ?? null;
  const allowed = filters.allowedBedrooms ?? [];
  const plus = filters.bedroomsMinPlus;
  if (allowed.length === 0 && plus == null) {
    if (typeof filters.bedroomsMin === "number" && filters.bedroomsMin > 0) {
      return b != null && b >= filters.bedroomsMin;
    }
    return true;
  }
  if (b != null && allowed.includes(b)) return true;
  if (plus != null && b != null && b >= plus) return true;
  return false;
}

export function listingMatchesPriceFilter(
  price: number,
  filters: ScanRunFilters
): boolean {
  const min = Number(filters.priceMin ?? 0);
  const max = Number(filters.priceMax ?? 999_999_999);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return true;
  return price >= min && price <= max;
}

export function listingMatchesScanFilters(
  listing: { price?: number | null; bedrooms?: number | null },
  filters: ScanRunFilters
): boolean {
  const price = Number(listing.price ?? 0);
  if (!listingMatchesPriceFilter(price, filters)) return false;
  return listingMatchesBedroomFilter(listing.bedrooms, filters);
}
