"use client";

import type { ListingSummary } from "@/lib/listing/summary-types";
import { dealNumbersFromSummary, fmtEur } from "@/lib/listing/deal-numbers";
import { MetricCard } from "@/components/ui/MetricCard";

/**
 * "Los números": coste real de la operación (no solo el precio del anuncio).
 * Fórmula compartida con las tarjetas del feed — ver `deal-numbers.ts`.
 */
export function DealNumbersBlock({ summary, price }: { summary: ListingSummary; price: number }) {
  const deal = dealNumbersFromSummary(summary, price);
  const itp = deal.taxPct;
  const closingCosts = deal.closingCosts;
  const totalCost = deal.totalCost;
  const roiNet = deal.netYieldPct;
  const cash = deal.cashInvested;
  const rent = deal.rentMonthly;

  const rows = [
    { label: "Precio del anuncio", value: fmtEur(price), sub: null },
    {
      label: `ITP (${itp.toFixed(1)} % sobre precio)`,
      value: fmtEur(deal.taxAmount),
      sub: "Calculado sobre el precio; Hacienda puede liquidar sobre el valor de referencia de Catastro si es mayor.",
    },
    {
      label: "Gastos de cierre (notaría, registro, gestoría)",
      value: fmtEur(closingCosts),
      sub: "Estimación habitual del 1 % + 300 €.",
    },
    { label: "Coste total si no hay reforma", value: fmtEur(totalCost), sub: null, strong: true },
  ];

  return (
    <section className="brasa-card overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink">Los números</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Lo que cuesta de verdad la operación y lo que puede dar.
        </p>
      </div>
      <dl className="px-5 py-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4 border-b border-line/60 py-2.5 last:border-0">
            <div className="min-w-0">
              <dt className={`text-[13px] ${r.strong ? "font-semibold text-ink" : "text-ink-muted"}`}>
                {r.label}
              </dt>
              {r.sub && <p className="mt-0.5 text-[10px] leading-snug text-ink-muted/70">{r.sub}</p>}
            </div>
            <dd
              className={`shrink-0 tabular-nums ${
                r.strong ? "text-[15px] font-bold text-ink" : "text-[13px] font-semibold text-ink"
              }`}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
        <MetricCard
          label="Inversión total"
          value={fmtEur(totalCost)}
          size="sm"
          note={
            cash > 0 && Math.abs(cash - totalCost) > 1 ? `Con reforma prevista: ${fmtEur(cash)}` : undefined
          }
        />
        <MetricCard
          label="Rentabilidad neta"
          value={roiNet != null ? roiNet.toFixed(2) : "—"}
          unit={roiNet != null ? "%" : undefined}
          sub={rent != null ? `${fmtEur(rent)}/mes − 18 % gastos` : "Sin renta fiable"}
          size="sm"
        />
      </div>
    </section>
  );
}

/**
 * "Antes de comprar": a favor, a vigilar y qué comprobar.
 * Derivado de datos reales del listing — no texto genérico.
 */
export function BeforeBuyingBlock({ summary, price }: { summary: ListingSummary; price: number }) {
  const pros: string[] = [];
  const watch: string[] = [];
  const check: string[] = [];

  const o = summary.opportunity;
  if (o.discountPct != null && o.discountPct >= 8) {
    pros.push(
      `Se vende un ${Math.round(o.discountPct)} % por debajo de su valoración orientativa (${fmtEur(o.valuationMid)}).`
    );
  }
  if (o.sellerKind === "bank") pros.push("Vendedor banco o servicer: margen de negociación habitual.");
  if (summary.roi.rentConfidence === "high") {
    pros.push(`Renta respaldada por ${summary.roi.comparablesCount} alquileres reales en la zona.`);
  }
  if (summary.neighborhood.vsCpPct != null && summary.neighborhood.vsCpPct < -5) {
    pros.push(
      `El €/m² de este anuncio está ${Math.abs(Math.round(summary.neighborhood.vsCpPct))} % por debajo de la media del código postal.`
    );
  }
  if (pros.length === 0) pros.push("Dentro de los rangos habituales de mercado de su zona.");

  if (o.discountPct != null && o.discountPct > 30) {
    watch.push(
      "Descuento muy elevado: comprueba estado real, ocupación y cargas antes de pujar. Puede incluir obra pendiente."
    );
  }
  if (o.scrapedAgeDays != null && o.scrapedAgeDays > 45) {
    watch.push(`El anuncio lleva ${o.scrapedAgeDays} días publicado: verifica que sigue disponible.`);
  }
  if (summary.roi.rentConfidence !== "high") {
    watch.push(
      "La renta es una estimación con pocos comparables: valida precios de alquiler reales del mismo edificio o calle."
    );
  }
  if (summary.listingId && summary.demographics && "note" in summary.demographics) {
    watch.push("Sin datos censales INE de la sección: usa el mercado notarial del CP como referencia.");
  }

  check.push("Nota simple del Registro de la Propiedad: titularidad, cargas y anotaciones.");
  check.push("Estado real del inmueble: visita o pide fotos y vídeo recientes.");
  check.push("Certificado energético, ITE del edificio y cédula de habitabilidad donde se exija.");
  check.push("Comunidad de propietarios al día y recibo de IBI del último año.");
  check.push(`Presupuesto de reforma: sobre ${fmtEur(price)}, una obra media puede ir del 8 % al 20 %.`);

  const Col = ({
    title,
    items,
    tone,
  }: {
    title: string;
    items: string[];
    tone: "ok" | "warn" | "neutral";
  }) => {
    const dot = tone === "ok" ? "bg-lime" : tone === "warn" ? "bg-amber" : "bg-ink-muted/50";
    return (
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">{title}</h3>
        <ul className="mt-2 space-y-2">
          {items.map((t) => (
            <li key={t} className="flex gap-2 text-[12px] leading-snug text-ink">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <section className="brasa-card overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink">Antes de comprar</h2>
        <p className="mt-0.5 text-xs text-ink-muted">Lo bueno, lo que vigilar y qué comprobar.</p>
      </div>
      <div className="grid gap-5 px-5 py-4 sm:grid-cols-2">
        <Col title="A favor" items={pros} tone="ok" />
        <Col title={watch.length ? "A vigilar" : "Qué comprobar"} items={watch.length ? watch : check.slice(0, 3)} tone="warn" />
      </div>
      <div className="border-t border-line px-5 py-4">
        <Col title="Qué comprobar" items={check} tone="neutral" />
      </div>
    </section>
  );
}
