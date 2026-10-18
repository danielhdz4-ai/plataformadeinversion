/** Alquiler mensual razonable en España (€/mes). Evita precios de venta mal clasificados. */
export const RENT_MIN_EUR = 150;
export const RENT_MAX_EUR = 15_000;

export function isPlausibleMonthlyRent(price) {
  const n = Number(price);
  return Number.isFinite(n) && n >= RENT_MIN_EUR && n <= RENT_MAX_EUR;
}
