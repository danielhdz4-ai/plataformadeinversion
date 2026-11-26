"use client";

import type { OpportunityMetrics } from "@/lib/listing/opportunity-metrics";

/** Regla de valoración: precio pedido vs banda orientativa. Mismo lenguaje Brasa. */
export function PriceValuationSlider({
  price,
  metrics,
}: {
  price: number;
  metrics: OpportunityMetrics | null | undefined;
}) {
  const low = metrics?.valuationLow;
  const high = metrics?.valuationHigh;
  const mid = metrics?.valuationMid;
  if (low == null || high == null || mid == null || high <= low) return null;

  const span = high - low;
  const pricePct = clampPct(((price - low) / span) * 100);
  const midPct = clampPct(((mid - low) / span) * 100);
  const belowMid = price <= mid;

  const conf = metrics?.valuationConfidence ?? "low";
  const confLabel =
    conf === "high" ? "Confianza alta" : conf === "medium" ? "Confianza media" : "Confianza baja · orientativa";

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[22px] font-extrabold leading-none tracking-tight text-ink tabular-nums">
          {Math.round(mid).toLocaleString("es-ES")} <span className="text-xs font-semibold text-ink-muted">€</span>
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
            belowMid ? "bg-lime/15 text-lime" : "bg-clay/15 text-clay"
          }`}
        >
          Piden {Math.round(price).toLocaleString("es-ES")} €
        </span>
      </div>
      <div className="flex justify-between text-[10px] font-semibold tabular-nums text-ink-muted">
        <span>{Math.round(low).toLocaleString("es-ES")} €</span>
        <span>{Math.round(high).toLocaleString("es-ES")} €</span>
      </div>
      <div className="relative h-2 rounded-full bg-line">
        <div
          className="absolute inset-y-0 rounded-full bg-lime/30"
          style={{ left: `${Math.min(pricePct, midPct)}%`, width: `${Math.abs(pricePct - midPct)}%` }}
        />
        <div
          className="absolute top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-full bg-mint"
          style={{ left: `${midPct}%` }}
          title="Valoración orientativa"
        />
        <div
          className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-void shadow ${
            belowMid ? "bg-lime" : "bg-clay"
          }`}
          style={{ left: `${pricePct}%` }}
          title="Precio pedido"
        />
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-[10px] text-ink-muted">
        <span>
          Piden · valoración ≈{" "}
          <span className="font-bold tabular-nums text-ink">{mid.toLocaleString("es-ES")} €</span>
        </span>
        <span>{confLabel}</span>
      </div>
    </div>
  );
}

function clampPct(n: number) {
  return Math.min(100, Math.max(0, n));
}
