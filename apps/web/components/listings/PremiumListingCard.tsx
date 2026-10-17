"use client";

import { ListingAiAnalysisBlock } from "@/components/listings/ListingAiAnalysisBlock";
import { ListingResumenPanel } from "@/components/listings/ListingResumenPanel";
import { decodeListingTitle } from "@/lib/decode-html";
import type { ListingSummary } from "@/lib/listing/summary-types";
import { portalBadge } from "@/lib/portals";
import { SaveListingButton } from "@/components/listings/SaveListingButton";
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
  price: number;
  sourcePortal?: string | null;
  thumbnailUrl?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqm?: number | null;
  roi?: number | null;
  rentEst?: number | null;
  sourceUrl?: string;
  selected?: boolean;
  onHover?: () => void;
  summary?: ListingSummary | null;
  summaryLoading?: boolean;
  /** Resumen completo en panel derecho; lista más compacta */
  compact?: boolean;
  onSelect?: () => void;
};

export function PremiumListingCard({
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
  rentEst,
  sourceUrl,
  selected,
  onHover,
  summary,
  summaryLoading,
  compact = false,
  onSelect,
}: PremiumListingCardProps) {
  const portal = portalBadge(sourcePortal);
  const cleanTitle = decodeListingTitle(title);
  const imgSrc = proxiedThumb(thumbnailUrl);
  const [thumbFailed, setThumbFailed] = useState(false);
  useEffect(() => setThumbFailed(false), [thumbnailUrl]);
  const showThumb = Boolean(imgSrc) && !thumbFailed;

  const specs = [
    bedrooms != null ? `${bedrooms} hab.` : null,
    bathrooms != null ? `${bathrooms} baños` : null,
    sqm != null ? `${sqm} m²` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const displayRoi = summary?.roi.grossRoiPct ?? roi ?? null;
  const displayRent = summary?.roi.rentEstMonthly ?? rentEst ?? null;
  const priceM2 = summary?.pricePerSqm ?? (sqm && sqm > 0 ? price / sqm : null);

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
      className={`flex w-full max-w-full shrink-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md ${
        selected ? "border-neutral-950 ring-2 ring-neutral-950" : "border-neutral-200"
      } ${onSelect ? "cursor-pointer" : ""}`}
    >
      <div className={`relative w-full shrink-0 overflow-hidden bg-neutral-100 ${imageHeight}`}>
        <Link
          href={`/app/listings/${listingId}`}
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
            <div className="flex h-full flex-col items-center justify-center gap-1 text-neutral-400">
              <span className="text-xs uppercase tracking-widest">{portal.name}</span>
              <span className="text-[10px]">Sin foto</span>
            </div>
          )}
        </Link>
        {displayRoi != null && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-neutral-950 px-2.5 py-1 text-xs font-bold tabular-nums text-white">
            {displayRoi.toFixed(2)}% ROI
          </span>
        )}
      </div>

      <div className="space-y-2 border-b border-neutral-100 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/app/listings/${listingId}`}
            className="min-w-0 flex-1"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="line-clamp-2 text-sm font-semibold capitalize text-neutral-950">{cleanTitle}</h3>
          </Link>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <SaveListingButton listingId={listingId} compact className="!px-1.5 !py-0.5 !text-[10px]" />
            <span className="rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-700">
              {portal.name}
            </span>
          </div>
        </div>
        {city && <p className="text-xs text-neutral-500">{city}</p>}
        {specs && <p className="text-xs text-neutral-600">{specs}</p>}
        <div className="flex flex-wrap items-end justify-between gap-2 pt-1">
          <p className="text-lg font-bold tabular-nums text-neutral-950">{price.toLocaleString("es-ES")} €</p>
          {displayRent != null && (
            <p className="text-xs tabular-nums text-neutral-600">
              {Math.round(displayRent).toLocaleString("es-ES")} €/mes est.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <Metric label="€/m²" value={priceM2 != null ? `${Math.round(priceM2).toLocaleString("es-ES")}` : "—"} />
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
                  ? "warn"
                  : summary.neighborhood.vsCpPct < -5
                    ? "ok"
                    : "neutral"
                : "neutral"
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
        <div className="animate-pulse space-y-2 bg-[#faf9f7] px-3 py-4">
          <div className="h-3 w-2/3 rounded bg-neutral-200" />
          <div className="h-20 rounded bg-neutral-200" />
          <div className="h-14 rounded bg-neutral-200" />
        </div>
      )}

      {!compact && summary && (
        <>
          <ListingResumenPanel summary={summary} listingId={listingId} embedded />
          <div className="border-t border-neutral-100 px-3 py-3">
            <ListingAiAnalysisBlock listingId={listingId} compact />
          </div>
        </>
      )}

      {sourceUrl && (
        <div className="border-t border-neutral-100 px-3 py-2">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-medium text-neutral-600 underline"
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
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn";
}) {
  const valueClass =
    tone === "warn" ? "text-red-700" : tone === "ok" ? "text-emerald-800" : "text-neutral-950";
  return (
    <div className="rounded-md border border-neutral-100 bg-[#faf9f7] px-2 py-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`text-xs font-bold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
