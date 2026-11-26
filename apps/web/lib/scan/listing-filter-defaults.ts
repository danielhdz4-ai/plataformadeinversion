import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";
import { defaultPortalToggles, selectedPortals } from "@/lib/scan/portal-options";

/** Filtros por defecto en Explorar / vista mapa. */
export function defaultListingFilters(): ScanRunFilters {
  return {
    priceMin: 0,
    priceMax: 2_000_000,
    sqmMin: 0,
    sqmMax: 500,
    allowedBedrooms: [0, 1, 2, 3],
    bedroomsMinPlus: 4,
    allowedBathrooms: [1, 2, 3],
    bathroomsMinPlus: 4,
    sourcePortals: selectedPortals(defaultPortalToggles()),
    minRoiGross: 0,
    onlyWithRoi: false,
  };
}
