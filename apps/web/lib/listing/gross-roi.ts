import { grossRoiPct } from "@pi/roi-engine";

const RENT_MIN = 150;
const RENT_MAX = 15_000;

/** ROI bruto alineado con precompute-roi: (rent×12)/precio, no el cache si el precio cambió. */
export function resolveListingGrossRoiPct(
  price: number,
  rentEstMonthly: number | null | undefined,
  storedRoiGross: number | null | undefined
): number | null {
  if (
    price >= 25_000 &&
    rentEstMonthly != null &&
    rentEstMonthly >= RENT_MIN &&
    rentEstMonthly <= RENT_MAX
  ) {
    const pct = grossRoiPct(price, rentEstMonthly);
    return pct > 0 && pct <= 50 ? pct : null;
  }
  if (
    storedRoiGross != null &&
    storedRoiGross > 0 &&
    storedRoiGross <= 100
  ) {
    return storedRoiGross;
  }
  return null;
}
