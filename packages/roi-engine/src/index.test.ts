import { describe, expect, it } from "vitest";
import { calculateBuyToLet, grossRoiPct } from "./index.js";

describe("calculateBuyToLet", () => {
  it("caso referencia 155k / 1105€ / ITP 10% cash", () => {
    const r = calculateBuyToLet({
      purchasePrice: 155_000,
      monthlyRent: 1105,
      itpPct: 10,
      downPaymentPct: 100,
    });
    expect(r.itpAmount).toBeCloseTo(15_500, 0);
    expect(r.totalInvestment).toBeCloseTo(170_500, 0);
    expect(r.grossYieldPct).toBeCloseTo(8.55, 1);
    expect(r.roiOnCashInvestedPct).toBeCloseTo(7.78, 1);
  });
});

describe("grossRoiPct", () => {
  it("matches yield on price", () => {
    expect(grossRoiPct(155_000, 1105)).toBeCloseTo(8.55, 1);
  });
});
