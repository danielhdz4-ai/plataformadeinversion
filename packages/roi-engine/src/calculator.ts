import { mortgageSplit } from "./mortgage.js";

export type CalculatorMode = "buy_to_rent" | "airbnb" | "flip";

export type BuyToLetCalculatorInput = {
  purchasePrice: number;
  itpPct: number;
  ajdPct: number;
  renovation: number;
  monthlyRent: number;
  occupancyPct: number;
  leverage: boolean;
  downPaymentPct: number;
  mortgageYears: number;
  mortgageRatePct: number;
  ibiRatePct: number;
  cadastralValuePct: number;
  monthlyOpex: number;
  furnishing?: number;
};

export type AirbnbCalculatorInput = BuyToLetCalculatorInput & {
  pricePerNight: number;
  avgStayNights: number;
  cleaningPerStay: number;
  platformCommissionPct: number;
  managementCommissionPct: number;
  suppliesMonthly: number;
  furnishing: number;
};

export type FlipCalculatorInput = {
  purchasePrice: number;
  sqm: number;
  renovationCostPerSqm: number;
  transactionCostsPct: number;
  expectedSalePrice: number;
};

function ibiMonthly(purchasePrice: number, cadastralValuePct: number, ibiRatePct: number) {
  const annual = purchasePrice * (cadastralValuePct / 100) * (ibiRatePct / 100);
  return annual / 12;
}

export type BuyToLetCalculatorResult = {
  mode: "buy_to_rent";
  itpAmount: number;
  ajdAmount: number;
  totalPurchaseTax: number;
  downPayment: number;
  loanAmount: number;
  totalInitialInvestment: number;
  effectiveMonthlyRent: number;
  ibiMonthly: number;
  mortgage: ReturnType<typeof mortgageSplit>;
  netMonthlyCashFlow: number;
  annualEffectiveRent: number;
  annualOpex: number;
  annualIbi: number;
  netAnnualProfit: number;
  roiOnEquityPct: number;
  annualWealthCreation: number;
  monthlyWealthCreation: number;
};

export function calculateBuyToLetPro(input: BuyToLetCalculatorInput): BuyToLetCalculatorResult {
  const price = input.purchasePrice;
  const itpAmount = price * (input.itpPct / 100);
  const ajdAmount = price * (input.ajdPct / 100);
  const totalPurchaseTax = itpAmount + ajdAmount;
  const downPct = input.leverage ? input.downPaymentPct : 100;
  const downPayment = price * (downPct / 100);
  const loanAmount = input.leverage ? Math.max(0, price - downPayment) : 0;
  const furnishing = input.furnishing ?? 0;
  const totalInitialInvestment = downPayment + totalPurchaseTax + input.renovation + furnishing;

  const effectiveMonthlyRent = input.monthlyRent * (input.occupancyPct / 100);
  const ibiMo = ibiMonthly(price, input.cadastralValuePct, input.ibiRatePct);
  const mortgage = mortgageSplit(loanAmount, input.mortgageRatePct, input.mortgageYears);

  const netMonthlyCashFlow =
    effectiveMonthlyRent - input.monthlyOpex - ibiMo - mortgage.monthlyPayment;

  const annualEffectiveRent = effectiveMonthlyRent * 12;
  const annualOpex = input.monthlyOpex * 12;
  const annualIbi = ibiMo * 12;
  const netAnnualProfit =
    annualEffectiveRent - mortgage.annualInterest - annualOpex - annualIbi;

  const roiOnEquityPct =
    totalInitialInvestment > 0 ? (netAnnualProfit / totalInitialInvestment) * 100 : 0;

  const annualWealthCreation = netMonthlyCashFlow * 12 + mortgage.annualPrincipal;

  return {
    mode: "buy_to_rent",
    itpAmount,
    ajdAmount,
    totalPurchaseTax,
    downPayment,
    loanAmount,
    totalInitialInvestment,
    effectiveMonthlyRent,
    ibiMonthly: ibiMo,
    mortgage,
    netMonthlyCashFlow,
    annualEffectiveRent,
    annualOpex,
    annualIbi,
    netAnnualProfit,
    roiOnEquityPct,
    annualWealthCreation,
    monthlyWealthCreation: annualWealthCreation / 12,
  };
}

export type AirbnbCalculatorResult = Omit<BuyToLetCalculatorResult, "mode"> & {
  mode: "airbnb";
  nightsPerMonth: number;
  staysPerMonth: number;
  grossMonthlyAirbnb: number;
  platformFeeMonthly: number;
  cleaningMonthly: number;
  managementFeeMonthly: number;
  suppliesMonthly: number;
  netAirbnbIncomeMonthly: number;
  annualNetAirbnbIncome: number;
};

export function calculateAirbnbPro(input: AirbnbCalculatorInput): AirbnbCalculatorResult {
  const nightsPerMonth = ((365 / 12) * input.occupancyPct) / 100;
  const grossMonthlyAirbnb = nightsPerMonth * input.pricePerNight;
  const platformFeeMonthly = grossMonthlyAirbnb * (input.platformCommissionPct / 100);
  const staysPerMonth = input.avgStayNights > 0 ? nightsPerMonth / input.avgStayNights : 0;
  const cleaningMonthly = staysPerMonth * input.cleaningPerStay;
  const managementFeeMonthly = grossMonthlyAirbnb * (input.managementCommissionPct / 100);
  const netAirbnbIncomeMonthly =
    grossMonthlyAirbnb -
    platformFeeMonthly -
    cleaningMonthly -
    managementFeeMonthly -
    input.suppliesMonthly;

  const base = calculateBuyToLetPro({
    ...input,
    monthlyRent: netAirbnbIncomeMonthly,
    occupancyPct: 100,
    furnishing: input.furnishing,
  });

  const annualNetAirbnbIncome = netAirbnbIncomeMonthly * 12;
  const netAnnualProfit =
    annualNetAirbnbIncome -
    base.mortgage.annualInterest -
    base.annualOpex -
    base.annualIbi;
  const roiOnEquityPct =
    base.totalInitialInvestment > 0
      ? (netAnnualProfit / base.totalInitialInvestment) * 100
      : 0;

  return {
    ...base,
    mode: "airbnb",
    nightsPerMonth,
    staysPerMonth,
    grossMonthlyAirbnb,
    platformFeeMonthly,
    cleaningMonthly,
    managementFeeMonthly,
    suppliesMonthly: input.suppliesMonthly,
    netAirbnbIncomeMonthly,
    annualNetAirbnbIncome,
    effectiveMonthlyRent: netAirbnbIncomeMonthly,
    annualEffectiveRent: annualNetAirbnbIncome,
    netAnnualProfit,
    roiOnEquityPct,
  };
}

export type FlipCalculatorResult = {
  mode: "flip";
  renovationTotal: number;
  transactionCosts: number;
  totalInitialInvestment: number;
  expectedSalePrice: number;
  profit: number;
  flipRoiPct: number;
};

export function calculateFlip(input: FlipCalculatorInput): FlipCalculatorResult {
  const renovationTotal = input.sqm * input.renovationCostPerSqm;
  const transactionCosts = input.purchasePrice * (input.transactionCostsPct / 100);
  const totalInitialInvestment = input.purchasePrice + renovationTotal + transactionCosts;
  const profit = input.expectedSalePrice - totalInitialInvestment;
  const flipRoiPct =
    totalInitialInvestment > 0 ? (profit / totalInitialInvestment) * 100 : 0;
  return {
    mode: "flip",
    renovationTotal,
    transactionCosts,
    totalInitialInvestment,
    expectedSalePrice: input.expectedSalePrice,
    profit,
    flipRoiPct,
  };
}
