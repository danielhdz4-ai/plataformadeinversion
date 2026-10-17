import type { SidePanelListing } from "@/components/listings/ListingDetailSidePanel";

/** Datos mínimos para el panel cuando el pin no está en el ranking/listado. */
export function pinFallbackListing(
  id: string,
  pin: { price: number; roi: number | null; rentEst?: number | null }
): SidePanelListing {
  return {
    id,
    title: null,
    price: pin.price,
    roi: pin.roi,
    rentEst: pin.rentEst ?? null,
  };
}
