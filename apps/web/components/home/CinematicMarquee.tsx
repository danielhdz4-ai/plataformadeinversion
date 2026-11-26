"use client";

import { decodeListingTitle } from "@/lib/decode-html";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type HeroDeal = {
  id: string;
  title: string | null;
  price: number;
  city: string | null;
  postalCode: string | null;
  thumbnailUrl: string | null;
  sourcePortal: string | null;
  bedrooms: number | null;
  sqm: number | null;
  discountPct: number | null;
  valuationMid: number | null;
};

function proxiedThumb(url: string | null) {
  if (!url) return null;
  if (url.includes("pisos.com") || url.includes("kelify.com")) {
    return `/api/image-proxy?u=${encodeURIComponent(url)}`;
  }
  return url;
}

function MarqueItem({ deal }: { deal: HeroDeal }) {
  const thumb = proxiedThumb(deal.thumbnailUrl);
  return (
    <Link
      href={`/app/listings/${deal.id}`}
      className="group flex w-[290px] shrink-0 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 transition hover:border-lime/50"
    >
      <div className="h-12 w-14 shrink-0 overflow-hidden rounded-lg bg-deep">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold tabular-nums text-ink">
          {deal.price.toLocaleString("es-ES")} €
        </p>
        <p className="truncate text-[11px] text-ink-muted">
          {[decodeListingTitle(deal.city ?? ""), deal.postalCode].filter(Boolean).join(" · ") || "España"}
        </p>
      </div>
      {deal.discountPct != null && deal.discountPct >= 5 && (
        <span className="shrink-0 rounded-md bg-lime/15 px-1.5 py-1 text-[11px] font-extrabold tabular-nums text-lime">
          −{Math.round(deal.discountPct)} %
        </span>
      )}
    </Link>
  );
}

/**
 * Cinta infinita de chollos reales. Es puramente decorativa-funcional:
 * enlaza a la ficha de cada inmueble.
 */
export function CinematicMarquee({ initial = [] }: { initial?: HeroDeal[] }) {
  const [deals, setDeals] = useState<HeroDeal[]>(initial);

  useEffect(() => {
    if (initial.length > 0) return;
    let cancelled = false;
    fetch("/api/public/hero-deals")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: HeroDeal[] }) => {
        if (!cancelled) setDeals(d.items ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initial.length]);

  const loop = useMemo(() => [...deals, ...deals], [deals]);
  if (deals.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden py-3">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-void to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-void to-transparent" />
      <div className="brasa-marquee-track gap-3 px-3">
        {loop.map((deal, i) => (
          <MarqueItem key={`${deal.id}-${i}`} deal={deal} />
        ))}
      </div>
    </div>
  );
}
