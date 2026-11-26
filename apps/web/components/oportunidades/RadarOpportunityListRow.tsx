"use client";

import type { RadarOpportunityCardProps } from "@/components/oportunidades/RadarOpportunityCard";
import { decodeListingTitle } from "@/lib/decode-html";
import { computeOpportunityMetrics } from "@/lib/listing/opportunity-metrics";
import { resolveListingSqm } from "@/lib/listing/resolve-sqm";
import { portalBadge } from "@/lib/portals";
import { SELLER_KIND_LABEL } from "@/lib/listing/seller-kind";
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

export function RadarOpportunityListRow(props: RadarOpportunityCardProps) {
  const {
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
  } = props;

  const fichaHref = listingDetailHref(listingId, returnTo);
  const portal = portalBadge(sourcePortal);
  const cleanTitle = decodeListingTitle(title);
  const imgSrc = proxiedThumb(thumbnailUrl);
  const [thumbFailed, setThumbFailed] = useState(false);
  useEffect(() => setThumbFailed(false), [thumbnailUrl]);

  const effectiveSqm = resolveListingSqm(sqm, title);
  const displayRoi = summary?.roi.grossRoiPct ?? roi ?? null;
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

  return (
    <article
      onClick={onSelect}
      className={`flex cursor-pointer gap-4 overflow-hidden rounded-xl border bg-white p-3 shadow-sm transition hover:shadow-md ${
        selected ? "border-neutral-900 ring-1 ring-neutral-900/10" : "border-neutral-200/90"
      }`}
    >
      <div className="relative h-28 w-36 shrink-0 overflow-hidden rounded-lg bg-neutral-100 sm:h-32 sm:w-44">
        {imgSrc && !thumbFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-neutral-400">{portal.name}</div>
        )}
        {score != null && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
            {score}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {opportunity.sellerKind !== "unknown" && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {SELLER_KIND_LABEL[opportunity.sellerKind]}
              </span>
            )}
            {opportunity.discountPct != null && opportunity.discountPct >= 5 && (
              <span className="text-[10px] font-semibold text-emerald-700">
                −{Math.round(opportunity.discountPct)} % vs valoración
              </span>
            )}
          </div>
          <Link href={fichaHref} onClick={(e) => e.stopPropagation()} className="mt-1 block truncate text-sm font-semibold text-neutral-950 hover:underline">
            {cleanTitle}
          </Link>
          {city && <p className="truncate text-xs text-neutral-500">{decodeListingTitle(city)}</p>}
          {(bedrooms != null || bathrooms != null) && (
            <p className="text-[11px] text-neutral-600">
              {[bedrooms != null ? `${bedrooms} hab.` : null, bathrooms != null ? `${bathrooms} baños` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-lg font-bold tabular-nums text-neutral-950">{price.toLocaleString("es-ES")} €</p>
            {opportunity.valuationMid != null && (
              <p className="text-xs tabular-nums text-emerald-800">
                Valoración ≈ {opportunity.valuationMid.toLocaleString("es-ES")} €
              </p>
            )}
          </div>
          {displayRoi != null && (
            <p className="text-sm font-bold tabular-nums text-emerald-700">{displayRoi.toFixed(1)} % bruto</p>
          )}
        </div>
      </div>

      <div className="hidden shrink-0 flex-col justify-center gap-2 sm:flex">
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-center text-xs font-semibold text-white hover:bg-neutral-800"
          >
            Contactar
          </a>
        ) : null}
        <Link
          href={fichaHref}
          onClick={(e) => e.stopPropagation()}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-center text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
        >
          Analizar
        </Link>
      </div>
    </article>
  );
}
