import { RENT_MAX_EUR, RENT_MIN_EUR, isPlausibleMonthlyRent } from "./rent-plausible.mjs";

/** Techo mensual coherente con el precio de venta (~8% bruto anual máx. en heurística). */
export function capRentEstForSalePrice(rentEst, salePrice) {
  const price = Number(salePrice);
  let rent = Math.round(Number(rentEst));
  if (!Number.isFinite(price) || price <= 0 || !isPlausibleMonthlyRent(rent)) return null;
  const maxByPrice = Math.min(RENT_MAX_EUR, Math.max(RENT_MIN_EUR, Math.round(price * 0.0065)));
  rent = Math.min(rent, maxByPrice);
  return isPlausibleMonthlyRent(rent) ? rent : null;
}
