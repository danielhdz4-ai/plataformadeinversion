import { describe, expect, it } from "vitest";
import { calculateAirbnbPro, calculateBuyToLetPro, calculateFlip } from "./calculator.js";

describe("calculateBuyToLetPro (ROI Explorer ref)", () => {
  it("230k BTL 20% down 10% ITP", () => {
    const r = calculateBuyToLetPro({
      purchasePrice: 230_000,
      itpPct: 10,
      ajdPct: 0,
      renovation: 0,
      monthlyRent: 900,
      occupancyPct: 100,
      leverage: true,
      downPaymentPct: 20,
      mortgageYears: 30,
      mortgageRatePct: 2,
      ibiRatePct: 0.84,
      cadastralValuePct: 50,
      monthlyOpex: 100,
    });
    expect(r.totalInitialInvestment).toBeCloseTo(69_000, 0);
    expect(r.netMonthlyCashFlow).toBeCloseTo(39, 0);
    expect(r.roiOnEquityPct).toBeCloseTo(7.24, 1);
  });
});

describe("calculateAirbnbPro", () => {
  it("230k airbnb furnished", () => {
    const r = calculateAirbnbPro({
      purchasePrice: 230_000,
      itpPct: 10,
      ajdPct: 0,
      renovation: 0,
      monthlyRent: 0,
      occupancyPct: 60,
      leverage: true,
      downPaymentPct: 20,
      mortgageYears: 30,
      mortgageRatePct: 2,
      ibiRatePct: 0.84,
      cadastralValuePct: 50,
      monthlyOpex: 100,
      pricePerNight: 100,
      avgStayNights: 3,
      cleaningPerStay: 40,
      platformCommissionPct: 15,
      managementCommissionPct: 0,
      suppliesMonthly: 150,
      furnishing: 8000,
    });
    expect(r.totalInitialInvestment).toBeCloseTo(77_000, 0);
    expect(r.roiOnEquityPct).toBeCloseTo(10.5, 0);
    expect(r.netMonthlyCashFlow).toBeCloseTo(297, 0);
  });
});

describe("calculateFlip", () => {
  it("flip ROI ~29.69%", () => {
    const r = calculateFlip({
      purchasePrice: 230_000,
      sqm: 80,
      renovationCostPerSqm: 500,
      transactionCostsPct: 10,
      expectedSalePrice: 380_000,
    });
    expect(r.totalInitialInvestment).toBeCloseTo(293_000, 0);
    expect(r.profit).toBeCloseTo(87_000, 0);
    expect(r.flipRoiPct).toBeCloseTo(29.69, 1);
  });
});
