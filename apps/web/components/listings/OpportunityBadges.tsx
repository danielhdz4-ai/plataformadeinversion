"use client";

import { formatScrapedAgeEs } from "@/lib/listing/opportunity-metrics";
import type { OpportunityMetrics } from "@/lib/listing/opportunity-metrics";
import { SELLER_KIND_LABEL } from "@/lib/listing/seller-kind";

/**
 * Badges Brasa: una sola forma (pill), un solo peso tipográfico y
 * colores exclusivamente de la paleta. Sin bordes ni tintes ajenos.
 */
const pill =
  "inline-flex items-center rounded-full px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.06em] leading-none";

export function OpportunityVerifiedBadge() {
  return <span className={`${pill} bg-lime text-lime-ink`}>Oportunidad</span>;
}

export function DiscountPctBadge({ pct }: { pct: number | null | undefined }) {
  if (pct == null || pct < 5) return null;
  return (
    <span className={`${pill} bg-lime text-lime-ink tabular-nums normal-case`}>
      −{Math.round(pct)} %
    </span>
  );
}

export function OpportunityScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  const tone =
    score >= 75
      ? "bg-mint text-lime-ink"
      : score >= 50
        ? "bg-amber text-lime-ink"
        : "bg-raised text-ink-muted";
  return <span className={`${pill} tabular-nums normal-case ${tone}`}>{score}/100</span>;
}

export function SellerKindBadge({ kind }: { kind: OpportunityMetrics["sellerKind"] }) {
  if (kind === "unknown") return null;
  const styles: Record<string, string> = {
    bank: "bg-mint/15 text-mint",
    agency: "bg-ink/10 text-ink",
    private: "bg-ink/10 text-ink",
    auction: "bg-clay/15 text-clay",
  };
  return (
    <span className={`${pill} ${styles[kind] ?? styles.agency}`}>{SELLER_KIND_LABEL[kind]}</span>
  );
}

export function ValuationSnippet({
  price,
  valuationMid,
  valuationLow,
  valuationHigh,
  discountPct,
}: {
  price: number;
  valuationMid: number | null;
  valuationLow?: number | null;
  valuationHigh?: number | null;
  discountPct: number | null;
}) {
  if (valuationMid == null) return null;
  const range =
    valuationLow != null && valuationHigh != null
      ? `${Math.round(valuationLow).toLocaleString("es-ES")}–${Math.round(valuationHigh).toLocaleString("es-ES")} €`
      : null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
      <span className="text-[19px] font-extrabold leading-none tabular-nums tracking-tight text-ink">
        {price.toLocaleString("es-ES")} <span className="text-xs font-semibold text-ink-muted">€</span>
      </span>
      <span className="tabular-nums text-ink-muted">
        ≈ <span className="font-semibold text-ink">{valuationMid.toLocaleString("es-ES")} €</span> valoración
      </span>
      {discountPct != null && discountPct > 3 && (
        <span className={`${pill} bg-lime/15 tabular-nums text-lime normal-case`}>
          −{discountPct.toFixed(0)} % bajo valor
        </span>
      )}
      {discountPct != null && discountPct < -3 && (
        <span className={`${pill} bg-clay/15 tabular-nums text-clay normal-case`}>
          +{Math.abs(discountPct).toFixed(0)} % sobre valor
        </span>
      )}
      {range && <span className="w-full text-[10px] text-ink-muted/70">Horquilla habitual: {range}</span>}
    </div>
  );
}

/**
 * Marquesina de valoración: "Pagas X € por un piso valorado en Y €".
 */
export function PriceVsValuationHeadline({
  price,
  valuationMid,
  valuationLow,
  valuationHigh,
  discountPct,
  propertyLabel = "esta vivienda",
}: {
  price: number;
  valuationMid: number | null;
  valuationLow?: number | null;
  valuationHigh?: number | null;
  discountPct: number | null;
  propertyLabel?: string;
}) {
  const fmt = (n: number) => Math.round(n).toLocaleString("es-ES");
  if (valuationMid == null) {
    return <p className="text-3xl font-extrabold tabular-nums tracking-tight text-ink">{fmt(price)} €</p>;
  }
  const under = discountPct != null && discountPct > 0;
  return (
    <div className="space-y-1">
      <p className="text-2xl font-extrabold leading-snug tracking-tight text-ink sm:text-3xl">
        Pagas <span className="tabular-nums">{fmt(price)} €</span> por {propertyLabel} valorada en{" "}
        <span className="tabular-nums text-lime">{fmt(valuationMid)} €</span>
        {under && discountPct != null && (
          <span className="ml-1.5 rounded-full bg-lime px-2.5 py-0.5 align-middle text-sm font-bold tabular-nums text-lime-ink">
            −{Math.round(discountPct)} %
          </span>
        )}
      </p>
      <p className="text-xs text-ink-muted">
        {valuationLow != null && valuationHigh != null
          ? `Horquilla razonable ${fmt(valuationLow)}–${fmt(valuationHigh)} € · `
          : ""}
        calculada con ventas notariales de la zona y comparables de mercado.
      </p>
    </div>
  );
}

export function ScrapedAgeLabel({ metrics }: { metrics: OpportunityMetrics | null | undefined }) {
  const label = formatScrapedAgeEs(metrics?.scrapedAgeDays ?? null);
  if (!label) return null;
  return <span className="text-[10px] text-ink-muted"> · {label}</span>;
}
