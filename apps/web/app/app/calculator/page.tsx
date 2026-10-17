"use client";

import { calculateBuyToLet } from "@pi/roi-engine";
import { useMemo, useState } from "react";

export default function CalculatorPage() {
  const [price, setPrice] = useState(155_000);
  const [rent, setRent] = useState(1105);
  const [itp, setItp] = useState(10);

  const result = useMemo(
    () =>
      calculateBuyToLet({
        purchasePrice: price,
        monthlyRent: rent,
        itpPct: itp,
        downPaymentPct: 100,
      }),
    [price, rent, itp]
  );

  return (
    <div className="mx-auto grid max-w-4xl gap-8 px-6 py-10 md:grid-cols-2">
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Calculadora buy-to-let</h1>
        <label className="block text-sm text-slate-400">
          Precio compra (€)
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </label>
        <label className="block text-sm text-slate-400">
          Alquiler mensual (€)
          <input
            type="number"
            value={rent}
            onChange={(e) => setRent(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </label>
        <label className="block text-sm text-slate-400">
          ITP (%)
          <input
            type="number"
            value={itp}
            onChange={(e) => setItp(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </label>
      </section>
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="mb-4 text-lg font-medium">Resultado</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Inversión total (cash)</dt>
            <dd>{result.totalInvestment.toLocaleString("es-ES")} €</dd>
          </div>
          <div className="flex justify-between">
            <dt>Rentabilidad bruta</dt>
            <dd>{result.grossYieldPct.toFixed(2)} %</dd>
          </div>
          <div className="flex justify-between text-emerald-400">
            <dt>ROI sobre capital</dt>
            <dd>{result.roiOnCashInvestedPct.toFixed(2)} %</dd>
          </div>
          <div className="flex justify-between">
            <dt>Cash flow anual</dt>
            <dd>{result.annualCashFlow.toLocaleString("es-ES")} €</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
