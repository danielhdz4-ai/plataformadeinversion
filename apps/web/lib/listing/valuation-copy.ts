import type { ValuationConfidence } from "@/lib/listing/opportunity-metrics";

/** Texto orientativo tipo feed premium (descuento vs valoración). */
export function valuationDiscountCopy(
  discountPct: number | null | undefined,
  confidence: ValuationConfidence = "low"
): string | null {
  if (discountPct == null) return null;
  if (confidence === "low" && discountPct > 12) return null;
  if (discountPct >= 15) return "Precio muy por debajo de su valoración.";
  if (discountPct >= 8) return "Precio por debajo de su valoración.";
  if (discountPct >= 3) return "Ligeramente por debajo de valoración.";
  if (discountPct <= -8) return "Por encima de la valoración orientativa.";
  return null;
}
