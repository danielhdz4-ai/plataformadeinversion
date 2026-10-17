"use client";

import {
  CalcSection,
  fmtEuro,
  Line,
  ResultCard,
  TaxSummaryBox,
} from "@/components/calculator/calc-ui";
import { RangeField } from "@/components/ui/RangeField";
import {
  calculateAirbnbPro,
  calculateBuyToLetPro,
  calculateFlip,
  type CalculatorMode,
} from "@pi/roi-engine";
import { useMemo, useRef, useState } from "react";

const MODES: { id: CalculatorMode; label: string }[] = [
  { id: "buy_to_rent", label: "Compra para alquilar" },
  { id: "airbnb", label: "Alquiler turístico" },
  { id: "flip", label: "Flipping" },
];

export function RoiCalculatorApp() {
  const printRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<CalculatorMode>("buy_to_rent");

  const [purchasePrice, setPurchasePrice] = useState(230_000);
  const [itpPct, setItpPct] = useState(10);
  const [ajdPct, setAjdPct] = useState(0);
  const [renovation, setRenovation] = useState(0);

  const [monthlyRent, setMonthlyRent] = useState(900);
  const [occupancyPct, setOccupancyPct] = useState(100);

  const [pricePerNight, setPricePerNight] = useState(100);
  const [avgStayNights, setAvgStayNights] = useState(3);
  const [cleaningPerStay, setCleaningPerStay] = useState(40);
  const [platformCommissionPct, setPlatformCommissionPct] = useState(15);
  const [managementCommissionPct, setManagementCommissionPct] = useState(0);
  const [suppliesMonthly, setSuppliesMonthly] = useState(150);
  const [furnishing, setFurnishing] = useState(8000);

  const [sqm, setSqm] = useState(80);
  const [renovationCostPerSqm, setRenovationCostPerSqm] = useState(500);
  const [transactionCostsPct, setTransactionCostsPct] = useState(10);
  const [expectedSalePrice, setExpectedSalePrice] = useState(380_000);

  const [leverage, setLeverage] = useState(true);
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [mortgageYears, setMortgageYears] = useState(30);
  const [mortgageRatePct, setMortgageRatePct] = useState(2);
  const [ibiRatePct, setIbiRatePct] = useState(0.84);
  const [cadastralValuePct, setCadastralValuePct] = useState(50);
  const [monthlyOpex, setMonthlyOpex] = useState(100);

  const itpAmount = purchasePrice * (itpPct / 100);
  const ajdAmount = purchasePrice * (ajdPct / 100);
  const totalPurchaseTax = itpAmount + ajdAmount;
  const totalTaxPct = purchasePrice > 0 ? (totalPurchaseTax / purchasePrice) * 100 : 0;
  const downPaymentEuro = purchasePrice * (downPaymentPct / 100);

  const setDownFromEuro = (euro: number) => {
    if (purchasePrice <= 0) return;
    setDownPaymentPct(Math.min(100, Math.max(0, (euro / purchasePrice) * 100)));
  };

  const rentalBase = useMemo(
    () => ({
      purchasePrice,
      itpPct,
      ajdPct,
      renovation,
      monthlyRent,
      occupancyPct,
      leverage,
      downPaymentPct,
      mortgageYears,
      mortgageRatePct,
      ibiRatePct,
      cadastralValuePct,
      monthlyOpex,
      furnishing: mode === "airbnb" ? furnishing : 0,
    }),
    [
      purchasePrice,
      itpPct,
      ajdPct,
      renovation,
      monthlyRent,
      occupancyPct,
      leverage,
      downPaymentPct,
      mortgageYears,
      mortgageRatePct,
      ibiRatePct,
      cadastralValuePct,
      monthlyOpex,
      furnishing,
      mode,
    ]
  );

  const btlResult = useMemo(
    () => (mode === "buy_to_rent" ? calculateBuyToLetPro(rentalBase) : null),
    [mode, rentalBase]
  );

  const airbnbResult = useMemo(
    () =>
      mode === "airbnb"
        ? calculateAirbnbPro({
            ...rentalBase,
            pricePerNight,
            avgStayNights,
            cleaningPerStay,
            platformCommissionPct,
            managementCommissionPct,
            suppliesMonthly,
            furnishing,
          })
        : null,
    [
      mode,
      rentalBase,
      pricePerNight,
      avgStayNights,
      cleaningPerStay,
      platformCommissionPct,
      managementCommissionPct,
      suppliesMonthly,
      furnishing,
    ]
  );

  const flipResult = useMemo(
    () =>
      mode === "flip"
        ? calculateFlip({
            purchasePrice,
            sqm,
            renovationCostPerSqm,
            transactionCostsPct,
            expectedSalePrice,
          })
        : null,
    [mode, purchasePrice, sqm, renovationCostPerSqm, transactionCostsPct, expectedSalePrice]
  );

  const rental = btlResult ?? airbnbResult;

  function downloadPdf() {
    window.print();
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f7f6f3]">
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 md:px-6">
        <div>
          <h1 className="text-lg font-semibold text-neutral-950">Calculadora ROI</h1>
          <p className="text-xs text-neutral-500">Financiación, cash flow y patrimonio — España</p>
        </div>
        <button
          type="button"
          onClick={downloadPdf}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium print:hidden"
        >
          Descargar PDF
        </button>
      </div>

      <div
        ref={printRef}
        id="roi-calculator-print"
        className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-2"
      >
        <div className="min-h-0 overflow-y-auto border-r border-neutral-200 bg-white p-4 md:p-6">
          <CalcSection title="Modo de calculadora">
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    mode === m.id
                      ? "border-neutral-950 bg-neutral-950 text-white"
                      : "border-neutral-300 text-neutral-800"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-neutral-600">País: España · Moneda: EUR (€)</p>
          </CalcSection>

          <CalcSection title="Precio de la propiedad">
            <RangeField
              label="Precio de compra"
              value={purchasePrice}
              min={0}
              max={5_000_000}
              step={5000}
              suffix="€"
              onChange={setPurchasePrice}
            />
          </CalcSection>

          {mode !== "flip" && (
            <CalcSection title="Impuestos de compra">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-neutral-600">
                  ITP (%)
                  <input
                    type="number"
                    step={0.1}
                    value={itpPct}
                    onChange={(e) => setItpPct(Number(e.target.value))}
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                  />
                  <span className="text-neutral-500">= {fmtEuro(itpAmount)} €</span>
                </label>
                <label className="text-xs text-neutral-600">
                  AJD (%)
                  <input
                    type="number"
                    step={0.1}
                    value={ajdPct}
                    onChange={(e) => setAjdPct(Number(e.target.value))}
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                  />
                  <span className="text-neutral-500">= {fmtEuro(ajdAmount)} €</span>
                </label>
              </div>
              <RangeField label="ITP" value={itpPct} min={0} max={15} step={0.1} suffix="%" onChange={setItpPct} />
              <RangeField label="AJD" value={ajdPct} min={0} max={3} step={0.1} suffix="%" onChange={setAjdPct} />
              <TaxSummaryBox total={totalPurchaseTax} pct={totalTaxPct} price={purchasePrice} />
            </CalcSection>
          )}

          {mode === "buy_to_rent" && (
            <CalcSection title="Alquiler">
              <RangeField
                label="Alquiler mensual estimado"
                value={monthlyRent}
                min={300}
                max={5000}
                step={25}
                suffix="€"
                onChange={setMonthlyRent}
              />
              <RangeField
                label="Tasa de ocupación"
                value={occupancyPct}
                min={50}
                max={100}
                step={1}
                suffix="%"
                hint="80 % ≈ 2,4 meses/año vacío."
                onChange={setOccupancyPct}
              />
            </CalcSection>
          )}

          {mode === "airbnb" && (
            <CalcSection title="Alquiler turístico">
              <RangeField label="Precio por noche" value={pricePerNight} min={30} max={600} step={5} suffix="€" onChange={setPricePerNight} />
              <RangeField label="Ocupación" value={occupancyPct} min={10} max={90} step={1} suffix="%" onChange={setOccupancyPct} />
              <label className="block text-xs text-neutral-600">
                Estancia media (noches)
                <input type="number" value={avgStayNights} onChange={(e) => setAvgStayNights(Number(e.target.value))} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" />
              </label>
              <RangeField label="Limpieza por estancia" value={cleaningPerStay} min={0} max={150} step={5} suffix="€" onChange={setCleaningPerStay} />
              <RangeField label="Comisión plataforma" value={platformCommissionPct} min={0} max={25} step={1} suffix="%" onChange={setPlatformCommissionPct} />
              <RangeField label="Comisión gestión" value={managementCommissionPct} min={0} max={30} step={1} suffix="%" onChange={setManagementCommissionPct} />
              <RangeField label="Suministros mensuales" value={suppliesMonthly} min={0} max={500} step={10} suffix="€" onChange={setSuppliesMonthly} />
              <RangeField label="Amueblamiento" value={furnishing} min={0} max={50_000} step={500} suffix="€" onChange={setFurnishing} />
            </CalcSection>
          )}

          {mode === "flip" && (
            <CalcSection title="Reforma y venta">
              <RangeField label="Tamaño" value={sqm} min={20} max={500} step={5} suffix=" m²" onChange={setSqm} />
              <RangeField label="Coste reforma / m²" value={renovationCostPerSqm} min={0} max={3000} step={50} suffix="€" onChange={setRenovationCostPerSqm} />
              <p className="text-xs text-neutral-500">= {fmtEuro(sqm * renovationCostPerSqm)} € reforma</p>
              <RangeField label="Costes transacción" value={transactionCostsPct} min={0} max={20} step={0.5} suffix="%" onChange={setTransactionCostsPct} />
              <RangeField label="Precio venta esperado" value={expectedSalePrice} min={0} max={5_000_000} step={5000} suffix="€" onChange={setExpectedSalePrice} />
            </CalcSection>
          )}

          {mode !== "flip" && (
            <>
              <CalcSection title="Reforma estimada">
                <RangeField label="Reforma" value={renovation} min={0} max={100_000} step={1000} suffix="€" onChange={setRenovation} />
              </CalcSection>

              <CalcSection title="Apalancamiento">
                <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  Usar hipoteca
                  <input type="checkbox" checked={leverage} onChange={(e) => setLeverage(e.target.checked)} className="h-4 w-4 accent-neutral-950" />
                </label>
                {!leverage && (
                  <p className="text-xs text-neutral-500">ROI sobre efectivo (entrada + impuestos).</p>
                )}
                <RangeField label="Entrada (%)" value={downPaymentPct} min={10} max={90} step={1} suffix="%" onChange={setDownPaymentPct} />
                <label className="text-xs text-neutral-600">
                  Entrada (€)
                  <input
                    type="number"
                    value={Math.round(downPaymentEuro)}
                    onChange={(e) => setDownFromEuro(Number(e.target.value))}
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                  />
                </label>
                <RangeField label="Plazo hipoteca" value={mortgageYears} min={5} max={40} step={1} suffix=" años" onChange={setMortgageYears} />
                <RangeField label="Tipo interés" value={mortgageRatePct} min={1} max={10} step={0.1} suffix="%" onChange={setMortgageRatePct} />
              </CalcSection>

              <CalcSection title="Impuestos anuales (IBI)">
                <RangeField label="IBI (% valor catastral)" value={ibiRatePct} min={0} max={2} step={0.01} suffix="%" onChange={setIbiRatePct} />
                <RangeField label="% valor catastral vs precio" value={cadastralValuePct} min={20} max={100} step={5} suffix="%" onChange={setCadastralValuePct} />
                <p className="text-[11px] text-neutral-500">
                  El IBI grava el valor catastral (suele ser inferior al de mercado). Titular a 1 de enero.
                </p>
              </CalcSection>

              <CalcSection title="Gastos operativos">
                <RangeField label="Gastos mensuales" value={monthlyOpex} min={0} max={1000} step={10} suffix="€" onChange={setMonthlyOpex} />
              </CalcSection>
            </>
          )}
        </div>

        <div className="min-h-0 overflow-y-auto p-4 md:p-6 print:bg-white">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">Resultados</h2>

          {flipResult && (
            <div className="space-y-4">
              <ResultCard
                accent="neutral"
                title="Inversión inicial total"
                headline={`${fmtEuro(flipResult.totalInitialInvestment)} €`}
              >
                <Line label="Precio propiedad" value={`${fmtEuro(purchasePrice)} €`} />
                <Line label={`Reforma (${sqm} m²)`} value={`${fmtEuro(flipResult.renovationTotal)} €`} />
                <Line label="Transacción" value={`${fmtEuro(flipResult.transactionCosts)} €`} />
              </ResultCard>
              <ResultCard accent="green" title="Precio venta esperado" headline={`${fmtEuro(flipResult.expectedSalePrice)} €`}>
                <Line label="Beneficio" value={`+${fmtEuro(flipResult.profit)} €`} tone="pos" />
              </ResultCard>
              <p className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
                Fórmula: (precio venta − inversión total) / inversión total ={" "}
                <strong>{flipResult.flipRoiPct.toFixed(2)} %</strong>
              </p>
            </div>
          )}

          {rental && (
            <div className="space-y-4">
              <ResultCard
                accent="neutral"
                title="Inversión inicial total"
                headline={`${fmtEuro(rental.totalInitialInvestment)} €`}
              >
                <Line label="Precio propiedad" value={`${fmtEuro(purchasePrice)} €`} />
                <Line label="Entrada inicial" value={`${fmtEuro(rental.downPayment)} €`} />
                <Line label={`Impuestos (${totalTaxPct.toFixed(1)} %)`} value={`${fmtEuro(rental.totalPurchaseTax)} €`} />
                {rental.mode === "airbnb" && furnishing > 0 && (
                  <Line label="Amueblamiento" value={`${fmtEuro(furnishing)} €`} />
                )}
                {renovation > 0 && <Line label="Reforma" value={`${fmtEuro(renovation)} €`} />}
                {leverage && <Line label="Préstamo" value={`${fmtEuro(rental.loanAmount)} €`} />}
              </ResultCard>

              <ResultCard
                accent="green"
                title="Flujo de caja"
                headline={`${rental.netMonthlyCashFlow >= 0 ? "+" : ""}${fmtEuro(rental.netMonthlyCashFlow)} €/mes`}
                sub="Lo que entra en tu cuenta cada mes"
              >
                {rental.mode === "airbnb" && airbnbResult && (
                  <>
                    <Line
                      label={`Ingresos Airbnb (${airbnbResult.nightsPerMonth.toFixed(1)} noches)`}
                      value={`+${fmtEuro(airbnbResult.grossMonthlyAirbnb)} €`}
                      tone="pos"
                    />
                    <Line label="Comisión plataforma" value={`−${fmtEuro(airbnbResult.platformFeeMonthly)} €`} tone="neg" />
                    <Line label={`Limpieza (${airbnbResult.staysPerMonth.toFixed(1)} est.)`} value={`−${fmtEuro(airbnbResult.cleaningMonthly)} €`} tone="neg" />
                    <Line label="Suministros" value={`−${fmtEuro(airbnbResult.suppliesMonthly)} €`} tone="neg" />
                  </>
                )}
                {rental.mode === "buy_to_rent" && (
                  <Line
                    label={`Alquiler efectivo (${occupancyPct} % occ.)`}
                    value={`+${fmtEuro(rental.effectiveMonthlyRent)} €`}
                    tone="pos"
                  />
                )}
                {leverage && rental.mortgage.monthlyPayment > 0 && (
                  <Line
                    label="Cuota hipotecaria (P+I)"
                    value={`−${fmtEuro(rental.mortgage.monthlyPayment)} €`}
                    tone="neg"
                    sub={
                      <>
                        <div>Intereses (coste real): {fmtEuro(rental.mortgage.monthlyInterest)} €</div>
                        <div>Capital (patrimonio): {fmtEuro(rental.mortgage.monthlyPrincipal)} €</div>
                      </>
                    }
                  />
                )}
                <Line label="Gastos operativos" value={`−${fmtEuro(monthlyOpex)} €`} tone="neg" />
                <Line label="IBI (mensual)" value={`−${fmtEuro(rental.ibiMonthly)} €`} tone="neg" />
                <Line
                  label="Flujo mensual neto"
                  value={`${rental.netMonthlyCashFlow >= 0 ? "+" : ""}${fmtEuro(rental.netMonthlyCashFlow)} €`}
                  tone={rental.netMonthlyCashFlow >= 0 ? "pos" : "neg"}
                />
              </ResultCard>

              <ResultCard
                accent="blue"
                title="ROI sobre capital"
                headline={`${rental.roiOnEquityPct.toFixed(2)} %`}
                sub="Rentabilidad sobre tu dinero invertido (sin amortizar capital como gasto)"
              >
                <Line label="Ingresos anuales netos" value={`+${fmtEuro(rental.annualEffectiveRent)} €`} tone="pos" />
                <Line label="Intereses anuales" value={`−${fmtEuro(rental.mortgage.annualInterest)} €`} tone="neg" />
                <Line label="Gastos operativos anuales" value={`−${fmtEuro(rental.annualOpex)} €`} tone="neg" />
                <Line label="Rentabilidad neta anual" value={`+${fmtEuro(rental.netAnnualProfit)} €`} tone="pos" />
                <Line label="Capital invertido" value={`${fmtEuro(rental.totalInitialInvestment)} €`} />
              </ResultCard>

              <ResultCard
                accent="purple"
                title="Creación de patrimonio anual"
                headline={`+${fmtEuro(rental.annualWealthCreation)} €/año`}
                sub={`≈ ${fmtEuro(rental.monthlyWealthCreation)} €/mes`}
              >
                <Line label="Flujo de caja anual (×12)" value={`+${fmtEuro(rental.netMonthlyCashFlow * 12)} €`} tone="pos" />
                <Line label="Capital amortizado" value={`+${fmtEuro(rental.mortgage.annualPrincipal)} €`} tone="pos" />
                <Line label="Patrimonio total generado" value={`+${fmtEuro(rental.annualWealthCreation)} €`} tone="pos" />
              </ResultCard>
            </div>
          )}

          <p className="mt-6 text-[10px] leading-relaxed text-neutral-500 print:text-neutral-700">
            Estimaciones orientativas según los parámetros introducidos. Los rendimientos reales dependen del
            mercado, vacancia, fiscalidad personal y condiciones de financiación. Consulta con asesores
            financieros e inmobiliarios antes de invertir.
          </p>
        </div>
      </div>
    </div>
  );
}
