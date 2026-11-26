import type { ListingSummary } from "@/lib/listing/summary-types";

/**
 * Coste real de la operación. Una sola fórmula para toda la app:
 * feed, tarjeta, ficha y calculadora deben dar el mismo número.
 */
export type DealNumbers = {
  price: number;
  /** % ITP por comunidad autónoma resuelto en el resumen. */
  taxPct: number;
  taxAmount: number;
  /** Notaría + registro + gestoría (estimación: 1 % + 300 €). */
  closingCosts: number;
  /** Precio + impuestos + gastos de cierre. */
  totalCost: number;
  /** Inversión total declarada por el motor de ROI (si existe). */
  cashInvested: number;
  rentMonthly: number | null;
  /** Rentabilidad bruta sobre coste total. */
  grossYieldPct: number | null;
  /** Rentabilidad neta: 82 % de la renta anual / coste total. */
  netYieldPct: number | null;
};

export const CLOSING_COST_PCT = 0.01;
export const CLOSING_COST_FIXED = 300;
/** Provisiones (IBI, comunidad, seguro, mantenimiento, vacíos). */
export const EXPENSE_RATIO = 0.18;

export function computeDealNumbers(input: {
  price: number;
  taxPct?: number | null;
  taxAmount?: number | null;
  rentMonthly?: number | null;
  cashInvested?: number | null;
}): DealNumbers {
  const price = Math.max(0, input.price || 0);
  const taxPct = input.taxPct ?? 8;
  const taxAmount = input.taxAmount ?? price * (taxPct / 100);
  const closingCosts = price * CLOSING_COST_PCT + CLOSING_COST_FIXED;
  const totalCost = price + taxAmount + closingCosts;
  const rentMonthly = input.rentMonthly ?? null;
  const annualNetRent = rentMonthly != null ? rentMonthly * 12 * (1 - EXPENSE_RATIO) : null;
  return {
    price,
    taxPct,
    taxAmount,
    closingCosts,
    totalCost,
    cashInvested: input.cashInvested ?? totalCost,
    rentMonthly,
    grossYieldPct: rentMonthly != null && totalCost > 0 ? ((rentMonthly * 12) / totalCost) * 100 : null,
    netYieldPct: annualNetRent != null && totalCost > 0 ? (annualNetRent / totalCost) * 100 : null,
  };
}

export function dealNumbersFromSummary(summary: ListingSummary, price: number): DealNumbers {
  return computeDealNumbers({
    price,
    taxPct: summary.roi.purchaseTaxPct,
    taxAmount: summary.roi.purchaseTaxAmount,
    rentMonthly: summary.roi.rentEstMonthly,
    cashInvested: summary.roi.totalCashInvested,
  });
}

export function fmtEur(n: number | null | undefined): string {
  return n == null ? "—" : `${Math.round(n).toLocaleString("es-ES")} €`;
}
