export type BuyToLetInput = {
  purchasePrice: number;
  monthlyRent: number;
  itpPct: number;
  ajdPct?: number;
  renovation?: number;
  occupancyPct?: number;
  annualExpenses?: number;
  downPaymentPct?: number;
  mortgageRatePct?: number;
  mortgageYears?: number;
};

export type BuyToLetResult = {
  totalInvestment: number;
  itpAmount: number;
  ajdAmount: number;
  annualRentGross: number;
  annualRentEffective: number;
  annualMortgagePayment: number;
  annualCashFlow: number;
  roiOnCashInvestedPct: number;
  grossYieldPct: number;
};

export function calculateBuyToLet(input: BuyToLetInput): BuyToLetResult {
  const {
    purchasePrice,
    monthlyRent,
    itpPct,
    ajdPct = 0,
    renovation = 0,
    occupancyPct = 100,
    annualExpenses = 0,
    downPaymentPct = 100,
    mortgageRatePct = 0,
    mortgageYears = 0,
  } = input;

  const itpAmount = purchasePrice * (itpPct / 100);
  const ajdAmount = purchasePrice * (ajdPct / 100);
  const downPayment = purchasePrice * (downPaymentPct / 100);
  const totalInvestment = downPayment + itpAmount + ajdAmount + renovation;

  const annualRentGross = monthlyRent * 12;
  const annualRentEffective = annualRentGross * (occupancyPct / 100);

  let annualMortgagePayment = 0;
  if (downPaymentPct < 100 && mortgageYears > 0) {
    const principal = purchasePrice - downPayment;
    const r = mortgageRatePct / 100 / 12;
    const n = mortgageYears * 12;
    if (r === 0) {
      annualMortgagePayment = (principal / n) * 12;
    } else {
      const payment =
        (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      annualMortgagePayment = payment * 12;
    }
  }

  const annualCashFlow =
    annualRentEffective - annualExpenses - annualMortgagePayment;
  const roiOnCashInvestedPct =
    totalInvestment > 0 ? (annualCashFlow / totalInvestment) * 100 : 0;
  const grossYieldPct = (annualRentGross / purchasePrice) * 100;

  return {
    totalInvestment,
    itpAmount,
    ajdAmount,
    annualRentGross,
    annualRentEffective,
    annualMortgagePayment,
    annualCashFlow,
    roiOnCashInvestedPct,
    grossYieldPct,
  };
}

export function estimateRentFromComparables(
  comparables: { monthlyRent: number; sqm: number }[],
  targetSqm: number
): { rentEst: number; confidence: "high" | "medium" | "low"; count: number } {
  if (comparables.length === 0) {
    return { rentEst: 0, confidence: "low", count: 0 };
  }
  const eurPerSqm = comparables.map((c) => c.monthlyRent / c.sqm);
  eurPerSqm.sort((a, b) => a - b);
  const mid = Math.floor(eurPerSqm.length / 2);
  const median =
    eurPerSqm.length % 2 === 0
      ? (eurPerSqm[mid - 1]! + eurPerSqm[mid]!) / 2
      : eurPerSqm[mid]!;
  const rentEst = Math.round(median * targetSqm);
  const confidence =
    comparables.length >= 5 ? "high" : comparables.length >= 3 ? "medium" : "low";
  return { rentEst, confidence, count: comparables.length };
}

export function grossRoiPct(purchasePrice: number, monthlyRent: number): number {
  if (purchasePrice <= 0) return 0;
  return ((monthlyRent * 12) / purchasePrice) * 100;
}

import { monthlyMortgagePayment } from "./mortgage.js";

export { monthlyMortgagePayment, mortgageSplit } from "./mortgage.js";
export type { MortgageSplit } from "./mortgage.js";
export {
  calculateAirbnbPro,
  calculateBuyToLetPro,
  calculateFlip,
} from "./calculator.js";
export type {
  AirbnbCalculatorInput,
  AirbnbCalculatorResult,
  BuyToLetCalculatorInput,
  BuyToLetCalculatorResult,
  CalculatorMode,
  FlipCalculatorInput,
  FlipCalculatorResult,
} from "./calculator.js";

/**
 * Precio máximo de compra si el efectivo inicial cubre entrada + impuestos (ITP/AJD…).
 * Ej.: 50 000 € efectivo, 20 % entrada + 7,7 % impuestos → ~180 505 €.
 */
export function maxPurchasePriceFromCash(params: {
  cashBudget: number;
  downPaymentPct: number;
  transferTaxPct: number;
}): number {
  const cashPct = params.downPaymentPct + params.transferTaxPct;
  if (cashPct <= 0 || params.cashBudget <= 0) return 0;
  return params.cashBudget / (cashPct / 100);
}

export type AffordabilityBreakdown = {
  maxPurchasePrice: number;
  downPayment: number;
  transferTax: number;
  totalCashRequired: number;
  mortgagePrincipal: number;
  monthlyMortgage: number;
};

export function affordabilityBreakdown(params: {
  purchasePrice: number;
  downPaymentPct: number;
  transferTaxPct: number;
  mortgageRatePct: number;
  mortgageYears: number;
}): AffordabilityBreakdown {
  const price = params.purchasePrice;
  const downPayment = price * (params.downPaymentPct / 100);
  const transferTax = price * (params.transferTaxPct / 100);
  const mortgagePrincipal = Math.max(0, price - downPayment);
  return {
    maxPurchasePrice: price,
    downPayment,
    transferTax,
    totalCashRequired: downPayment + transferTax,
    mortgagePrincipal,
    monthlyMortgage: monthlyMortgagePayment(
      mortgagePrincipal,
      params.mortgageRatePct,
      params.mortgageYears
    ),
  };
}
