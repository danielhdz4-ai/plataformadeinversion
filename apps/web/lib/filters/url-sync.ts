import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";

/** Serializa filtros de vista en query string (Explorar / scan). */
export function filtersToUrlSearchParams(filters: ScanRunFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.priceMin != null && filters.priceMin > 0) p.set("pmin", String(Math.round(filters.priceMin)));
  if (filters.priceMax != null && filters.priceMax < 2_000_000) {
    p.set("pmax", String(Math.round(filters.priceMax)));
  }
  if (filters.minRoiGross != null && filters.minRoiGross > 0) {
    p.set("roi", String(filters.minRoiGross));
  }
  if (filters.onlyWithRoi) p.set("roiOnly", "1");
  if (filters.sqmMin != null && filters.sqmMin > 0) p.set("sqmMin", String(filters.sqmMin));
  if (filters.sqmMax != null && filters.sqmMax < 500) p.set("sqmMax", String(filters.sqmMax));
  if (filters.sourcePortals?.length) p.set("portals", filters.sourcePortals.join(","));
  if (filters.allowedBedrooms?.length) p.set("beds", filters.allowedBedrooms.join(","));
  if (filters.bedroomsMinPlus === 4) p.set("beds4", "1");
  if (filters.rentConfidenceMin) p.set("rconf", filters.rentConfidenceMin);
  if (filters.allowedBathrooms?.length) p.set("baths", filters.allowedBathrooms.join(","));
  if (filters.bathroomsMinPlus === 4) p.set("baths4", "1");
  if (filters.minDiscountPct != null && filters.minDiscountPct > 0) {
    p.set("disc", String(filters.minDiscountPct));
  }
  if (filters.minOpportunityScore != null && filters.minOpportunityScore > 0) {
    p.set("scmin", String(filters.minOpportunityScore));
  }
  if (filters.sellerKinds?.length) p.set("seller", filters.sellerKinds.join(","));
  if (filters.maxScrapedAgeDays != null && filters.maxScrapedAgeDays > 0) {
    p.set("fresh", String(filters.maxScrapedAgeDays));
  }
  return p;
}

/** Params solo usados en /app/oportunidades (cp de zona). */
export function opportunityCpToParams(cp: string | null): URLSearchParams {
  const p = new URLSearchParams();
  if (cp?.length === 5) p.set("cp", cp);
  return p;
}

export function explorarHrefFromFilters(
  filters: ScanRunFilters,
  opts?: { cp?: string | null }
): string {
  const p = filtersToUrlSearchParams(filters);
  if (opts?.cp?.length === 5) p.set("cp", opts.cp);
  const q = p.toString();
  return q ? `/app/explorar?${q}` : "/app/explorar";
}

export function oportunidadesHrefFromFilters(
  filters: ScanRunFilters,
  opts?: { cp?: string | null }
): string {
  const p = filtersToUrlSearchParams(filters);
  if (opts?.cp?.length === 5) p.set("cp", opts.cp);
  const q = p.toString();
  return q ? `/app/oportunidades?${q}` : "/app/oportunidades";
}

/** Wizard scan con filtros actuales de Oportunidades (alerta / zona). */
export function scanNuevoHrefFromFilters(
  filters: ScanRunFilters,
  opts?: { cp?: string | null; notifyEmail?: boolean }
): string {
  const p = filtersToUrlSearchParams(filters);
  if (opts?.cp?.length === 5) p.set("cp", opts.cp);
  if (opts?.notifyEmail) p.set("notify", "1");
  p.set("from", "oportunidades");
  const q = p.toString();
  return q ? `/app/scan/nuevo?${q}` : "/app/scan/nuevo";
}

export function filtersFromUrlSearchParams(params: URLSearchParams): Partial<ScanRunFilters> {
  const raw: Record<string, unknown> = {};
  if (params.has("pmin")) raw.priceMin = Number(params.get("pmin"));
  if (params.has("pmax")) raw.priceMax = Number(params.get("pmax"));
  if (params.has("roi")) raw.minRoiGross = Number(params.get("roi"));
  if (params.get("roiOnly") === "1") raw.onlyWithRoi = true;
  if (params.has("sqmMin")) raw.sqmMin = Number(params.get("sqmMin"));
  if (params.has("sqmMax")) raw.sqmMax = Number(params.get("sqmMax"));
  const portals = params.get("portals")?.split(",").filter(Boolean);
  if (portals?.length) raw.sourcePortals = portals;
  const beds = params.get("beds")?.split(",").map(Number).filter(Number.isFinite);
  if (beds?.length) raw.allowedBedrooms = beds;
  if (params.get("beds4") === "1") raw.bedroomsMinPlus = 4;
  const baths = params.get("baths")?.split(",").map(Number).filter(Number.isFinite);
  if (baths?.length) raw.allowedBathrooms = baths;
  if (params.get("baths4") === "1") raw.bathroomsMinPlus = 4;
  const rc = params.get("rconf");
  if (rc === "medium" || rc === "high") raw.rentConfidenceMin = rc;
  if (params.has("disc")) raw.minDiscountPct = Number(params.get("disc"));
  if (params.has("scmin")) raw.minOpportunityScore = Number(params.get("scmin"));
  else if (params.has("score")) raw.minOpportunityScore = Number(params.get("score"));
  const seller = params.get("seller")?.split(",").filter(Boolean);
  if (seller?.length) raw.sellerKinds = seller as ScanRunFilters["sellerKinds"];
  if (params.has("fresh")) raw.maxScrapedAgeDays = Number(params.get("fresh"));
  return raw;
}

export function mergeUrlFiltersInto(base: ScanRunFilters, params: URLSearchParams): ScanRunFilters {
  const fromUrl = filtersFromUrlSearchParams(params);
  const hasUrl = [...params.keys()].some((k) =>
    [
      "pmin",
      "pmax",
      "roi",
      "roiOnly",
      "sqmMin",
      "sqmMax",
      "portals",
      "beds",
      "beds4",
      "baths",
      "baths4",
      "rconf",
      "disc",
      "scmin",
      "score",
      "seller",
      "fresh",
    ].includes(k)
  );
  if (!hasUrl) return base;
  return { ...base, ...fromUrl };
}
