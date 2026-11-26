import { normalizeScanFilters, filterListings } from "@/lib/scan/apply-scan-filters";
import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";

/** Query params opcionales en GET /api/map/listings */
export function parseMapListingFilterParams(
  params: URLSearchParams
): ScanRunFilters | null {
  const hasAny =
    params.has("priceMin") ||
    params.has("priceMax") ||
    params.has("minRoi") ||
    params.has("portals") ||
    params.has("sqmMin") ||
    params.has("sqmMax") ||
    params.has("bedrooms") ||
    params.has("onlyWithRoi") ||
    params.has("rentConf");
  if (!hasAny) return null;

  const portals = params.get("portals")?.split(",").map((s) => s.trim()).filter(Boolean);
  const bedrooms = params
    .get("bedrooms")
    ?.split(",")
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n));

  return normalizeScanFilters({
    priceMin: params.get("priceMin") ?? undefined,
    priceMax: params.get("priceMax") ?? undefined,
    minRoiGross: params.get("minRoi") ?? undefined,
    onlyWithRoi: params.get("onlyWithRoi") === "1",
    sqmMin: params.get("sqmMin") ?? undefined,
    sqmMax: params.get("sqmMax") ?? undefined,
    sourcePortals: portals?.length ? portals : undefined,
    allowedBedrooms: bedrooms?.length ? bedrooms : undefined,
    bedroomsMinPlus: params.get("bedroomsPlus") === "4" ? 4 : null,
    rentConfidenceMin:
      params.get("rentConf") === "high" || params.get("rentConf") === "medium"
        ? (params.get("rentConf") as "high" | "medium")
        : null,
  });
}

export function mapListingFiltersToSearchParams(filters: ScanRunFilters): string {
  const p = new URLSearchParams();
  if (filters.priceMin != null && filters.priceMin > 0) p.set("priceMin", String(filters.priceMin));
  if (filters.priceMax != null && filters.priceMax < 999_999_999) {
    p.set("priceMax", String(filters.priceMax));
  }
  if (filters.minRoiGross != null && filters.minRoiGross > 0) {
    p.set("minRoi", String(filters.minRoiGross));
  }
  if (filters.onlyWithRoi) p.set("onlyWithRoi", "1");
  if (filters.sqmMin != null && filters.sqmMin > 0) p.set("sqmMin", String(filters.sqmMin));
  if (filters.sqmMax != null && filters.sqmMax < 500) p.set("sqmMax", String(filters.sqmMax));
  if (filters.sourcePortals?.length) p.set("portals", filters.sourcePortals.join(","));
  if (filters.allowedBedrooms?.length) p.set("bedrooms", filters.allowedBedrooms.join(","));
  if (filters.bedroomsMinPlus === 4) p.set("bedroomsPlus", "4");
  if (filters.rentConfidenceMin === "medium" || filters.rentConfidenceMin === "high") {
    p.set("rentConf", filters.rentConfidenceMin);
  }
  const s = p.toString();
  return s ? `&${s}` : "";
}

export { filterListings };
