"use client";

import { decodeListingTitle } from "@/lib/decode-html";
import type { ListingSummary } from "@/lib/listing/summary-types";
import { computeOpportunityMetrics } from "@/lib/listing/opportunity-metrics";
import { resolveListingSqm } from "@/lib/listing/resolve-sqm";
import { portalBadge } from "@/lib/portals";
import { SELLER_KIND_LABEL } from "@/lib/listing/seller-kind";
import { listingDetailHref } from "@/lib/listing/return-navigation";
import { listingOrigin, LISTING_ORIGIN_LABEL, LISTING_ORIGIN_CLASS } from "@/lib/listing/listing-origin";
import { valuationDiscountCopy } from "@/lib/listing/valuation-copy";
import { SaveListingButton } from "@/components/listings/SaveListingButton";
import { grossRoiForDisplay } from "@/lib/listing/display-roi";
import { formatScrapedAgeEs } from "@/lib/listing/opportunity-metrics";
import { computeDealNumbers, fmtEur } from "@/lib/listing/deal-numbers";
import Link from "next/link";
import { useEffect, useState } from "react";

function proxiedThumb(url: string | null | undefined) {
  if (!url) return null;
  if (url.includes("pisos.com") || url.includes("kelify.com")) {
    return `/api/image-proxy?u=${encodeURIComponent(url)}`;
  }
  return url;
}

export type RadarOpportunityCardProps = {
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
  sourceUrl?: string | null;
  scrapedAt?: string | null;
  summary?: ListingSummary | null;
  selected?: boolean;
  onSelect?: () => void;
  returnTo?: string | null;
  /** Posición en el feed: escalona la animación de entrada. */
  index?: number | null;
};

export function RadarOpportunityCard({
  listingId,
  title,
  city,
  price,
  sourcePortal,
  thumbnailUrl,
  bedrooms,
  bathrooms,
  sqm,
  roi,
  sourceUrl,
  scrapedAt,
  summary,
  selected,
  onSelect,
  returnTo,
  index = null,
}: RadarOpportunityCardProps) {
  const fichaHref = listingDetailHref(listingId, returnTo);
  const portal = portalBadge(sourcePortal);
  const cleanTitle = decodeListingTitle(title);
  const imgSrc = proxiedThumb(thumbnailUrl);
  const [thumbFailed, setThumbFailed] = useState(false);
  useEffect(() => setThumbFailed(false), [thumbnailUrl]);
  const showThumb = Boolean(imgSrc) && !thumbFailed;

  const effectiveSqm = resolveListingSqm(sqm, title);
  const displayRoi = grossRoiForDisplay(
    summary?.roi.grossRoiPct ?? roi ?? null,
    summary?.roi.rentConfidence ?? null,
    summary?.roi.comparablesCount ?? 0
  );
  const opportunity =
    summary?.opportunity ??
    computeOpportunityMetrics(
      {
        price,
        sqm: effectiveSqm,
        roi: displayRoi,
        sourcePortal,
        title: cleanTitle,
        sourceUrl: sourceUrl ?? undefined,
        scrapedAt,
        rentConfidence: summary?.roi.rentConfidence ?? null,
      },
      summary
    );

  const score = opportunity.opportunityScore;
  const displayRent = summary?.roi.rentEstMonthly ?? null;
  const isNew = opportunity.scrapedAgeDays != null && opportunity.scrapedAgeDays <= 7;
  const isRecent = !isNew && opportunity.scrapedAgeDays != null && opportunity.scrapedAgeDays <= 21;
  const ageLabel = formatScrapedAgeEs(opportunity.scrapedAgeDays);
  const origin = listingOrigin(scrapedAt);
  const valuationLine = valuationDiscountCopy(
    opportunity.discountPct,
    opportunity.valuationConfidence
  );
  const isAuction = opportunity.sellerKind === "auction";
  const deal = computeDealNumbers({
    price,
    taxPct: summary?.roi.purchaseTaxPct,
    taxAmount: summary?.roi.purchaseTaxAmount,
    rentMonthly: displayRent ?? summary?.roi.rentEstMonthly ?? null,
    cashInvested: summary?.roi.totalCashInvested,
  });

  const specParts: string[] = [];
  if (effectiveSqm != null) specParts.push(`${effectiveSqm} m²`);
  if (bedrooms != null) specParts.push(`${bedrooms} hab.`);
  if (bathrooms != null) specParts.push(`${bathrooms} baño${bathrooms === 1 ? "" : "s"}`);

  const scoreRing =
    score == null
      ? ""
      : score >= 75
        ? "from-emerald-500 to-emerald-700"
        : score >= 55
          ? "from-amber-400 to-amber-600"
          : "from-neutral-500 to-neutral-700";

  return (
    <article
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
      className={`brasa-card brasa-rise group flex flex-col overflow-hidden ${
        selected ? "!border-lime ring-1 ring-lime/40" : ""
      } ${onSelect ? "cursor-pointer" : ""}`}
      style={index != null ? { animationDelay: `${Math.min(index, 16) * 45}ms` } : undefined}
    >
      <div className="relative aspect-[5/4] w-full shrink-0 overflow-hidden bg-deep">
        {showThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc!}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            onError={() => setThumbFailed(true)}
            className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-deep to-void text-ink-muted">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">{portal.name}</span>
            <span className="text-xs text-ink-muted/70">Imagen no disponible</span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/35 to-transparent p-3 pb-8">
          <div className="flex flex-wrap gap-1.5">
            {opportunity.sellerKind !== "unknown" && (
              <span className="rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-neutral-800 shadow-sm backdrop-blur-sm">
                {SELLER_KIND_LABEL[opportunity.sellerKind]}
              </span>
            )}
            {isNew && (
              <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-900 shadow-sm">
                Nueva
              </span>
            )}
            {isRecent && (
              <span className="rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-medium text-neutral-700 shadow-sm">
                Reciente
              </span>
            )}
          </div>
        </div>

        {score != null && (
          <div
            className={`pointer-events-none absolute -right-0.5 top-3 flex h-[3.25rem] w-[3.25rem] flex-col items-center justify-center rounded-full bg-gradient-to-br ${scoreRing} text-white shadow-lg ring-[3px] ring-white`}
          >
            <span className="text-[15px] font-bold leading-none tabular-nums tracking-tight">{score}</span>
            <span className="text-[8px] font-medium uppercase leading-none opacity-90">score</span>
          </div>
        )}

        <div className="pointer-events-auto absolute bottom-3 left-3 z-10">
          <SaveListingButton listingId={listingId} compact className="!rounded-full !bg-white/95 !shadow-md backdrop-blur-sm" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
        <Link
          href={fichaHref}
          onClick={(e) => e.stopPropagation()}
          className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink transition hover:text-lime"
        >
          {cleanTitle}
        </Link>
        {(city || ageLabel) && (
          <p className="mt-1 flex flex-wrap items-center gap-1.5 truncate text-xs text-ink-muted">
            <span className="truncate">
              {[city ? decodeListingTitle(city) : null, ageLabel ? ageLabel.replace(/^·\s*/, "") : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${LISTING_ORIGIN_CLASS[origin]}`}
            >
              {LISTING_ORIGIN_LABEL[origin]}
            </span>
          </p>
        )}
        {specParts.length > 0 && (
          <p className="mt-1.5 text-[11px] font-medium text-ink-muted">{specParts.join(" · ")}</p>
        )}

        <div className="mt-3">
          <p className="text-[22px] font-extrabold leading-none tabular-nums tracking-tight text-ink">
            {price.toLocaleString("es-ES")} €
          </p>
          {deal && (
            <p className="mt-1.5 text-[11px] tabular-nums text-ink-muted">
              Coste real <span className="font-semibold text-ink">{fmtEur(deal.totalCost)}</span>
              {deal.netYieldPct != null ? ` · neta ${deal.netYieldPct.toFixed(1)} %` : ""}
            </p>
          )}
        </div>

        {opportunity.valuationMid != null && (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-line bg-deep px-3 py-2">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-muted">Valoración</p>
              <p className="truncate text-sm font-bold tabular-nums text-ink">
                {opportunity.valuationMid.toLocaleString("es-ES")} €
              </p>
            </div>
            {opportunity.discountPct != null && opportunity.discountPct > 3 && (
              <span className="shrink-0 rounded-md bg-lime px-2 py-1 text-[11px] font-extrabold tabular-nums text-lime-ink">
                −{Math.round(opportunity.discountPct)} %
              </span>
            )}
          </div>
        )}

        {valuationLine && (
          <p className="mt-2 text-[11px] leading-snug text-ink-muted">{valuationLine}</p>
        )}

        {displayRoi != null && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" />
            Rentabilidad{" "}
            <span className="tabular-nums text-mint">
              {displayRoi.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %
            </span>
          </p>
        )}

        <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-xl bg-lime py-2.5 text-center text-xs font-bold text-lime-ink transition hover:brightness-105"
            >
              {isAuction ? "Pujar" : "Contactar"}
            </a>
          ) : (
            <span className="rounded-xl border border-line py-2.5 text-center text-xs text-ink-muted/70">Sin enlace</span>
          )}
          <Link
            href={fichaHref}
            onClick={(e) => e.stopPropagation()}
            className="rounded-xl border border-line py-2.5 text-center text-xs font-semibold text-ink transition hover:border-lime/60 hover:text-lime"
          >
            Analizar
          </Link>
        </div>
      </div>
    </article>
  );
}
