import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";

export function normalizeScanFilters(raw: Record<string, unknown> | undefined): ScanRunFilters {
  const f = raw ?? {};
  const portals = Array.isArray(f.sourcePortals)
    ? f.sourcePortals.map(String).filter(Boolean)
    : undefined;
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
    sqmMin: f.sqmMin != null ? Number(f.sqmMin) : undefined,
    sqmMax: f.sqmMax != null ? Number(f.sqmMax) : undefined,
    allowedBathrooms: Array.isArray(f.allowedBathrooms)
      ? f.allowedBathrooms.map((n) => Number(n))
      : undefined,
    bathroomsMinPlus:
      f.bathroomsMinPlus != null && f.bathroomsMinPlus !== ""
        ? Number(f.bathroomsMinPlus)
        : null,
    sourcePortals: portals?.length ? portals : undefined,
    minRoiGross: f.minRoiGross != null ? Number(f.minRoiGross) : undefined,
    onlyWithRoi: f.onlyWithRoi === true,
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
      return b == null || b >= filters.bedroomsMin;
    }
    return true;
  }
  if (b == null) return true;
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

export function listingMatchesBathroomFilter(
  bathrooms: number | null | undefined,
  filters: ScanRunFilters
): boolean {
  const b = bathrooms ?? null;
  const allowed = filters.allowedBathrooms ?? [];
  const plus = filters.bathroomsMinPlus;
  if (allowed.length === 0 && plus == null) return true;
  if (b == null) return true;
  if (b != null && allowed.includes(b)) return true;
  if (plus != null && b != null && b >= plus) return true;
  return false;
}

export function listingMatchesSqmFilter(
  sqm: number | null | undefined,
  filters: ScanRunFilters
): boolean {
  if (filters.sqmMin == null && filters.sqmMax == null) return true;
  const s = sqm != null ? Number(sqm) : null;
  if (s == null || !Number.isFinite(s)) return true;
  if (filters.sqmMin != null && s < filters.sqmMin) return false;
  if (filters.sqmMax != null && s > filters.sqmMax) return false;
  return true;
}

export function listingMatchesPortalFilter(
  portal: string | null | undefined,
  filters: ScanRunFilters
): boolean {
  const allowed = filters.sourcePortals;
  if (!allowed?.length) return true;
  return portal != null && allowed.includes(portal);
}

export function listingMatchesScanFilters(
  listing: {
    price?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    sqm?: number | null;
    source_portal?: string | null;
  },
  filters: ScanRunFilters
): boolean {
  const price = Number(listing.price ?? 0);
  if (!listingMatchesPriceFilter(price, filters)) return false;
  if (!listingMatchesBedroomFilter(listing.bedrooms, filters)) return false;
  if (!listingMatchesBathroomFilter(listing.bathrooms, filters)) return false;
  if (!listingMatchesSqmFilter(listing.sqm, filters)) return false;
  if (!listingMatchesPortalFilter(listing.source_portal, filters)) return false;
  return true;
}
