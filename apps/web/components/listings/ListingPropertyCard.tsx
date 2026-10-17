"use client";

import { decodeListingTitle } from "@/lib/decode-html";
import { portalBadge } from "@/lib/portals";
import Link from "next/link";
import { useEffect, useState } from "react";

function proxiedThumb(url: string | null | undefined) {
  if (!url) return null;
  if (url.includes("pisos.com") || url.includes("kelify.com")) {
    return `/api/image-proxy?u=${encodeURIComponent(url)}`;
  }
  return url;
}

export function ListingPropertyCard({
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
}: {
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
}) {
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

  return (
    <article
      onMouseEnter={onHover}
      className={`flex w-full max-w-full shrink-0 flex-col overflow-hidden rounded-lg border bg-white transition hover:shadow-md ${
        selected ? "border-neutral-950 ring-2 ring-neutral-950" : "border-neutral-200"
      }`}
    >
      <Link href={`/app/listings/${listingId}`} className="flex flex-col">
        <div className="relative h-44 w-full shrink-0 overflow-hidden bg-neutral-100 sm:h-48">
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
          {roi != null && (
            <span className="absolute bottom-2 right-2 rounded bg-neutral-950 px-2 py-1 text-xs font-bold text-white">
              {roi.toFixed(2)}% ROI
            </span>
          )}
        </div>
        <div className="space-y-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold capitalize text-neutral-950">
              {cleanTitle}
            </h3>
            <span className="shrink-0 rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-700">
              {portal.name}
            </span>
          </div>
          {city && <p className="text-xs text-neutral-500">{city}</p>}
          {specs && <p className="text-xs text-neutral-600">{specs}</p>}
          {rentEst != null && (
            <p className="text-xs text-neutral-500">
              {Math.round(rentEst).toLocaleString("es-ES")} €/mes alquiler est.
            </p>
          )}
          <p className="pt-1 text-right text-base font-bold text-neutral-950">
            {price.toLocaleString("es-ES")} €
          </p>
        </div>
      </Link>
      {sourceUrl && (
        <div className="border-t border-neutral-100 px-3 py-2">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-neutral-600 underline"
          >
            Ver en {portal.name}
          </a>
        </div>
      )}
    </article>
  );
}
