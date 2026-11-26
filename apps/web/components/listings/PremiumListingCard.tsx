"use client";

import { ListingAiAnalysisBlock } from "@/components/listings/ListingAiAnalysisBlock";
import { ListingResumenPanel } from "@/components/listings/ListingResumenPanel";
import { decodeListingTitle } from "@/lib/decode-html";
import { cleanListingTitle } from "@/lib/listing/display-title";
import type { ListingSummary } from "@/lib/listing/summary-types";
import { resolveListingSqm } from "@/lib/listing/resolve-sqm";
import { portalBadge } from "@/lib/portals";
import { SaveListingButton } from "@/components/listings/SaveListingButton";
import {
  DiscountPctBadge,
  OpportunityScoreBadge,
  OpportunityVerifiedBadge,
  SellerKindBadge,
  ScrapedAgeLabel,
  ValuationSnippet,
} from "@/components/listings/OpportunityBadges";
import { computeOpportunityMetrics } from "@/lib/listing/opportunity-metrics";
import { listingDetailHref } from "@/lib/listing/return-navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

function proxiedThumb(url: string | null | undefined) {
  if (!url) return null;
  if (url.includes("pisos.com") || url.includes("kelify.com")) {
    return `/api/image-proxy?u=${encodeURIComponent(url)}`;
  }
  return url;
}

export type PremiumListingCardProps = {
  listingId: string;
  title: string;
  city?: string | null;
  postalCode?: string | null;
  price: number;
  sourcePortal?: string | null;
  thumbnailUrl?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqm?: number | null;
  roi?: number | null;
  rentEst?: number | null;
  sourceUrl?: string;
  scrapedAt?: string | null;
  selected?: boolean;
  onHover?: () => void;
  summary?: ListingSummary | null;
  summaryLoading?: boolean;
  /** Resumen completo en panel derecho; lista más compacta */
  compact?: boolean;
  onSelect?: () => void;
  /** Ruta scan/explorar para ?from= al abrir ficha completa */
  returnTo?: string | null;
  /** Feed Oportunidades: badge + acciones Contactar / Analizar */
  markedOpportunity?: boolean;
  investorActions?: boolean;
};

export function PremiumListingCard({
  listingId,
  title,
  city,
  postalCode,
  price,
  sourcePortal,
  thumbnailUrl,
  bedrooms,
  bathrooms,
  sqm,
  roi,
  rentEst,
  sourceUrl,
  scrapedAt,
  selected,
  onHover,
  summary,
  summaryLoading,
  compact = false,
  onSelect,
  returnTo,
  markedOpportunity = false,
  investorActions = false,
}: PremiumListingCardProps) {
  const fichaHref = listingDetailHref(listingId, returnTo);
  const portal = portalBadge(sourcePortal);
  const cleanTitle = cleanListingTitle(title, null);
  const imgSrc = proxiedThumb(thumbnailUrl);
  const [thumbFailed, setThumbFailed] = useState(false);
  useEffect(() => setThumbFailed(false), [thumbnailUrl]);
  const showThumb = Boolean(imgSrc) && !thumbFailed;

  const effectiveSqm = resolveListingSqm(sqm, title);
  const specs = [
    bedrooms != null ? `${bedrooms} hab.` : null,
    bathrooms != null ? `${bathrooms} baños` : null,
    effectiveSqm != null ? `${effectiveSqm} m²` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const displayRoi = summary?.roi.grossRoiPct ?? roi ?? null;
  const displayRent = summary?.roi.rentEstMonthly ?? rentEst ?? null;
  const opportunity =
    summary?.opportunity ??
    computeOpportunityMetrics(
      {
        price,
        sqm: effectiveSqm,
        roi: displayRoi,
        sourcePortal,
        title: cleanTitle,
        sourceUrl,
        scrapedAt,
        rentConfidence: summary?.roi.rentConfidence ?? null,
      },
      summary
    );
  const priceM2 =
    summary?.pricePerSqm ??
    (effectiveSqm != null && effectiveSqm > 0 ? price / effectiveSqm : null);

  const imageHeight = compact ? "h-32 sm:h-36" : "h-44 sm:h-48";

  return (
    <article
      onMouseEnter={onHover}
      onClick={onSelect}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      className={`brasa-rise flex w-full max-w-full shrink-0 flex-col overflow-hidden rounded-2xl border bg-surface transition ${
        selected ? "border-lime ring-1 ring-lime" : "border-line hover:border-ink/20"
      } ${onSelect ? "cursor-pointer" : ""}`}
    >
      <div className={`relative w-full shrink-0 overflow-hidden bg-raised ${imageHeight}`}>
        <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-wrap gap-1">
          {markedOpportunity && <OpportunityVerifiedBadge />}
          <DiscountPctBadge pct={opportunity.discountPct} />
          <SellerKindBadge kind={opportunity.sellerKind} />
          <OpportunityScoreBadge score={opportunity.opportunityScore} />
        </div>
        <Link
          href={fichaHref}
          className="block h-full w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {showThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc!}
              alt=""
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
              onError={() => setThumbFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-ink-muted">
              <span className="text-xs uppercase tracking-widest">{portal.name}</span>
              <span className="text-[10px]">Sin foto</span>
            </div>
          )}
        </Link>
        {displayRoi != null && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-lime px-2.5 py-1 text-xs font-bold tabular-nums text-lime-ink">
            {displayRoi.toFixed(2)} % ROI
          </span>
        )}
      </div>

      <div className="space-y-2 border-b border-line p-3">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={fichaHref}
            className="min-w-0 flex-1"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="line-clamp-2 text-sm font-bold capitalize text-ink">{cleanTitle}</h3>
          </Link>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <SaveListingButton listingId={listingId} compact className="!px-1.5 !py-0.5 !text-[10px]" />
            <span className="rounded-full bg-raised px-2 py-0.5 text-[10px] font-bold uppercase text-ink-muted">
              {portal.name}
            </span>
          </div>
        </div>
        {(city || postalCode) && (
          <p className="text-xs text-ink-muted">
            {[city ? decodeListingTitle(city) : null, postalCode ? `CP ${postalCode}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {specs && (
          <p className="text-xs text-ink-muted">
            {specs}
            <ScrapedAgeLabel metrics={opportunity} />
          </p>
        )}
        <div className="space-y-1 pt-1">
          <ValuationSnippet
            price={price}
            valuationMid={opportunity.valuationMid}
            valuationLow={opportunity.valuationLow}
            valuationHigh={opportunity.valuationHigh}
            discountPct={opportunity.discountPct}
          />
          {opportunity.valuationMid == null && (
            <p className="text-[19px] font-extrabold tabular-nums tracking-tight text-ink">
              {price.toLocaleString("es-ES")} <span className="text-xs font-semibold text-ink-muted">€</span>
            </p>
          )}
          <div className="flex flex-wrap items-end justify-between gap-2">
            {displayRoi != null && (
              <p className="text-xs font-bold tabular-nums text-lime">
                Rentabilidad {displayRoi.toFixed(1)} %
              </p>
            )}
            {displayRent != null && (
              <p className="text-xs tabular-nums text-ink-muted">
                {Math.round(displayRent).toLocaleString("es-ES")} €/mes est.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <Metric
            label="€/m²"
            value={
              priceM2 != null
                ? `${Math.round(priceM2).toLocaleString("es-ES")}`
                : summaryLoading && effectiveSqm == null
                  ? "…"
                  : "—"
            }
          />
          <Metric
            label="vs CP"
            value={
              summary?.neighborhood.vsCpPct != null
                ? `${summary.neighborhood.vsCpPct > 0 ? "+" : ""}${summary.neighborhood.vsCpPct.toFixed(1)}%`
                : summaryLoading
                  ? "…"
                  : "—"
            }
            tone={
              summary?.neighborhood.vsCpPct != null
                ? summary.neighborhood.vsCpPct > 5
                  ? "bad"
                  : summary.neighborhood.vsCpPct < -5
                    ? "good"
                    : "default"
                : "default"
            }
          />
          <Metric
            label="Inversión"
            value={
              summary?.roi.totalCashInvested != null
                ? `${Math.round(summary.roi.totalCashInvested / 1000)}k €`
                : "—"
            }
          />
          <Metric
            label="Ops. CP"
            value={summary?.notary?.operationsCount != null ? String(summary.notary.operationsCount) : "—"}
          />
        </div>
      </div>

      {!compact && summaryLoading && !summary && (
        <div className="space-y-2 px-3 py-4">
          <div className="shimmer h-3 w-2/3 rounded" />
          <div className="shimmer h-20 rounded-xl" />
          <div className="shimmer h-14 rounded-xl" />
        </div>
      )}

      {!compact && summary && (
        <>
          <div className="border-b border-line px-3 py-3">
            <ListingResumenPanel summary={summary} listingId={listingId} embedded />
          </div>
          <div className="px-3 py-3">
            <ListingAiAnalysisBlock listingId={listingId} compact />
          </div>
        </>
      )}

      {investorActions && (
        <div className="flex gap-2 border-t border-line p-3">
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded-full bg-lime py-2 text-center text-xs font-bold text-lime-ink transition hover:brightness-105"
            >
              Contactar
            </a>
          ) : (
            <span className="flex-1 rounded-full bg-raised py-2 text-center text-xs font-semibold text-ink-muted">
              Sin enlace
            </span>
          )}
          <Link
            href={fichaHref}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 rounded-full border border-line py-2 text-center text-xs font-bold text-ink transition hover:border-lime/60 hover:text-lime"
          >
            Analizar
          </Link>
        </div>
      )}

      {sourceUrl && !investorActions && (
        <div className="border-t border-line px-3 py-2">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-semibold text-ink-muted underline hover:text-lime"
          >
            Ver anuncio en {portal.name}
          </a>
        </div>
      )}
    </article>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad";
}) {
  const valueClass =
    tone === "bad" ? "text-clay" : tone === "good" ? "text-lime" : "text-ink";
  return (
    <div className="rounded-lg bg-raised/70 px-2 py-1.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-muted">{label}</p>
      <p className={`text-xs font-bold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
