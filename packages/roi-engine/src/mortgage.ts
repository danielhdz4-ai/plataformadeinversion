export function monthlyMortgagePayment(
  principal: number,
  annualRatePct: number,
  years: number
): number {
  if (principal <= 0 || years <= 0) return 0;
  const n = years * 12;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export type MortgageSplit = {
  monthlyPayment: number;
  monthlyInterest: number;
  monthlyPrincipal: number;
  annualInterest: number;
  annualPrincipal: number;
};

export function mortgageSplit(
  loanPrincipal: number,
  annualRatePct: number,
  years: number
): MortgageSplit {
  if (loanPrincipal <= 0 || years <= 0) {
    return {
      monthlyPayment: 0,
      monthlyInterest: 0,
      monthlyPrincipal: 0,
      annualInterest: 0,
      annualPrincipal: 0,
    };
  }
  const payment = monthlyMortgagePayment(loanPrincipal, annualRatePct, years);
  const r = annualRatePct / 100 / 12;
  let balance = loanPrincipal;
  let annualInterest = 0;
  let annualPrincipal = 0;
  let firstInterest = 0;
  let firstPrincipal = 0;
  for (let m = 0; m < 12; m++) {
    const interest = r === 0 ? 0 : balance * r;
    const principal = payment - interest;
    if (m === 0) {
      firstInterest = interest;
      firstPrincipal = principal;
    }
    annualInterest += interest;
    annualPrincipal += principal;
    balance = Math.max(0, balance - principal);
  }
  return {
    monthlyPayment: payment,
    monthlyInterest: firstInterest,
    monthlyPrincipal: firstPrincipal,
    annualInterest,
    annualPrincipal,
  };
}
