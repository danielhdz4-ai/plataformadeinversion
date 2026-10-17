"use client";

import {
  affordabilityBreakdown,
  maxPurchasePriceFromCash,
} from "@pi/roi-engine";

export function AffordabilityCard({
  cashBudget,
  downPct,
  taxPct,
  ratePct,
  years,
  leverage,
}: {
  cashBudget: number;
  downPct: number;
  taxPct: number;
  ratePct: number;
  years: number;
  leverage: boolean;
}) {
  const maxPrice = maxPurchasePriceFromCash({
    cashBudget,
    downPaymentPct: downPct,
    transferTaxPct: taxPct,
  });
  const b = affordabilityBreakdown({
    purchasePrice: maxPrice,
    downPaymentPct: downPct,
    transferTaxPct: taxPct,
    mortgageRatePct: leverage ? ratePct : 0,
    mortgageYears: leverage ? years : 0,
  });

  const fmt = (n: number) =>
    n.toLocaleString("es-ES", { maximumFractionDigits: 0 });

  const total = b.downPayment + b.transferTax + b.mortgagePrincipal;
  const wDown = total > 0 ? (b.downPayment / total) * 100 : 33;
  const wTax = total > 0 ? (b.transferTax / total) * 100 : 33;
  const wMort = total > 0 ? (b.mortgagePrincipal / total) * 100 : 34;

  return (
    <div className="rounded-xl border border-neutral-200 bg-[#f7f6f3] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        Propiedades asequibles hasta
      </p>
      <p className="mt-1 text-3xl font-bold text-neutral-950">{fmt(b.maxPurchasePrice)} €</p>
      <dl className="mt-4 space-y-1.5 text-sm text-neutral-700">
        <div className="flex justify-between">
          <span>Entrada ({downPct} %)</span>
          <span className="font-medium">{fmt(b.downPayment)} €</span>
        </div>
        {leverage && (
          <div className="flex justify-between">
            <span>Hipoteca ({100 - downPct} %)</span>
            <span className="font-medium">{fmt(b.mortgagePrincipal)} €</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Impuestos ({taxPct} %)</span>
          <span className="font-medium">{fmt(b.transferTax)} €</span>
        </div>
        <div className="flex justify-between border-t border-neutral-200 pt-2 font-semibold text-neutral-950">
          <span>Efectivo inicial total</span>
          <span>{fmt(b.totalCashRequired)} €</span>
        </div>
        {leverage && b.monthlyMortgage > 0 && (
          <div className="flex justify-between text-neutral-600">
            <span>Cuota hipoteca est.</span>
            <span>{fmt(b.monthlyMortgage)} €/mes</span>
          </div>
        )}
      </dl>
      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-neutral-200">
        <div className="bg-neutral-950" style={{ width: `${wDown}%` }} title="Entrada" />
        <div className="bg-neutral-500" style={{ width: `${wTax}%` }} title="Impuestos" />
        {leverage && <div className="bg-neutral-300" style={{ width: `${wMort}%` }} title="Hipoteca" />}
      </div>
      <p className="mt-2 text-[10px] text-neutral-500">
        Entrada · Impuestos{leverage ? " · Hipoteca (capital)" : ""}. Ajusta sliders para tu capacidad real.
      </p>
    </div>
  );
}
