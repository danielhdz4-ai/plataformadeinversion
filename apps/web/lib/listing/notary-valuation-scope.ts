import { NOTARY_NATIONAL_POSTAL } from "@/lib/notariado/resolve-notary";

/** Solo notariado del CP del anuncio — nunca la media nacional (inflaba descuentos). */
export function notaryRowForListingValuation(
  postalCode: string | null | undefined,
  byPostal: Map<string, Record<string, unknown>>
): Record<string, unknown> | null {
  const pc = postalCode?.trim();
  if (!pc || pc === NOTARY_NATIONAL_POSTAL) return null;
  const row = byPostal.get(pc);
  if (!row || row.postal_code === NOTARY_NATIONAL_POSTAL) return null;
  return row;
}

export function postalNotaryHasSignal(notary: Record<string, unknown> | null): boolean {
  if (!notary) return false;
  const m2 = notary.price_m2 != null ? Number(notary.price_m2) : null;
  const avg = notary.avg_price != null ? Number(notary.avg_price) : null;
  const ops = notary.operations_count != null ? Number(notary.operations_count) : null;
  if (m2 != null && m2 > 0) return true;
  if (avg != null && avg > 0 && ops != null && ops >= 8) return true;
  return false;
}
