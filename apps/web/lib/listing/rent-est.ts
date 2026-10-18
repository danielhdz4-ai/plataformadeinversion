const RENT_MIN = 150;
const RENT_MAX = 15_000;

/** Alquiler mostrable: rango mensual y coherente con precio de venta. */
export function resolveRentEstMonthly(
  salePrice: number,
  rentEst: number | null | undefined
): number | null {
  const price = Number(salePrice);
  const rent = rentEst != null ? Math.round(Number(rentEst)) : null;
  if (!Number.isFinite(price) || price < 25_000 || rent == null) return null;
  if (rent < RENT_MIN || rent > RENT_MAX) return null;
  const maxByPrice = Math.min(RENT_MAX, Math.max(RENT_MIN, Math.round(price * 0.0065)));
  if (rent > maxByPrice) return null;
  return rent;
}
