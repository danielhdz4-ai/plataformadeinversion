"use client";

import { ListingAiAnalysisBlock } from "@/components/listings/ListingAiAnalysisBlock";
import { ListingResumenPanel } from "@/components/listings/ListingResumenPanel";
import { NotariadoPortalPanel } from "@/components/notariado/NotariadoPortalPanel";
import { decodeListingTitle } from "@/lib/decode-html";
import type { ListingSummary } from "@/lib/listing/summary-types";
import { portalBadge } from "@/lib/portals";
import { SaveListingButton } from "@/components/listings/SaveListingButton";
import Link from "next/link";
import { useEffect, useState } from "react";

export type SidePanelListing = {
  id: string;
  title: string | null;
  price: number;
  city?: string | null;
  sourcePortal?: string | null;
  thumbnailUrl?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqm?: number | null;
  roi?: number | null;
  rentEst?: number | null;
  sourceUrl?: string | null;
  rank?: number | null;
};

type Tab = "resumen" | "notariado" | "ia" | "roi";

function proxiedThumb(url: string | null | undefined) {
  if (!url) return null;
  if (url.includes("pisos.com") || url.includes("kelify.com")) {
    return `/api/image-proxy?u=${encodeURIComponent(url)}`;
  }
  return url;
}

export function ListingDetailSidePanel({
  listing,
  summary,
  summaryLoading,
  onClose,
}: {
  listing: SidePanelListing | null;
  summary: ListingSummary | null;
  summaryLoading?: boolean;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("resumen");
  const [fetched, setFetched] = useState<SidePanelListing | null>(null);

  useEffect(() => {
    setTab("resumen");
    setFetched(null);
  }, [listing?.id]);

  useEffect(() => {
    if (!listing?.id) return;
    const needsFetch = !listing.title && !listing.thumbnailUrl;
    if (!needsFetch) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/listings/${listing.id}`);
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as {
        title: string;
        price: number;
        city: string;
        source_portal: string;
        thumbnail_url?: string | null;
        bedrooms?: number;
        bathrooms?: number;
        sqm?: number;
        source_url: string;
        investment?: { rent_est: number; roi_gross: number };
      };
      if (cancelled) return;
      setFetched({
        id: listing.id,
        title: data.title,
        price: Number(data.price),
        city: data.city,
        sourcePortal: data.source_portal,
        thumbnailUrl: data.thumbnail_url,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        sqm: data.sqm,
        sourceUrl: data.source_url,
        roi: data.investment?.roi_gross ?? listing.roi ?? null,
        rentEst: data.investment?.rent_est ?? listing.rentEst ?? null,
        rank: listing.rank,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [listing]);

  const resolved = fetched ?? listing;
  const tabClass = (active: boolean) =>
    `shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium ${
      active ? "bg-neutral-950 text-white" : "text-neutral-600 hover:bg-neutral-200/80"
    }`;

  const panelShell =
    "flex min-h-0 shrink-0 flex-col border-l border-neutral-200 bg-white w-full max-w-md xl:w-[min(440px,36vw)] xl:max-w-none";

  if (!resolved) {
    return (
      <aside className={`hidden xl:flex ${panelShell} bg-[#f7f6f3]`}>
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <p className="text-sm font-medium text-neutral-800">Detalle del inmueble</p>
          <p className="mt-2 max-w-xs text-xs text-neutral-500">
            Selecciona un piso en el mapa o en la lista para ver resumen, ROI, comparables y análisis.
          </p>
        </div>
      </aside>
    );
  }

  const portal = portalBadge(resolved.sourcePortal);
  const title = decodeListingTitle(resolved.title ?? "Inmueble");
  const imgSrc = proxiedThumb(resolved.thumbnailUrl);
  const specs = [
    resolved.bedrooms != null ? `${resolved.bedrooms} hab.` : null,
    resolved.bathrooms != null ? `${resolved.bathrooms} baños` : null,
    resolved.sqm != null ? `${resolved.sqm} m²` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const displayRoi = summary?.roi.grossRoiPct ?? resolved.roi ?? null;

  return (
    <aside
      className={`${panelShell} fixed inset-y-0 right-0 z-40 shadow-2xl xl:static xl:shadow-none`}
    >
      <div className="shrink-0 border-b border-neutral-200 bg-[#f7f6f3]">
        {imgSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc} alt="" className="h-36 w-full object-cover" />
        )}
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-neutral-950 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                  En venta
                </span>
                <span className="text-[10px] font-semibold uppercase text-neutral-500">{portal.name}</span>
                {resolved.rank != null && (
                  <span className="text-[10px] text-neutral-500">#{resolved.rank} ranking</span>
                )}
              </div>
              <h2 className="mt-1 line-clamp-2 text-sm font-semibold capitalize text-neutral-950">{title}</h2>
              {resolved.city && <p className="text-xs text-neutral-500">{resolved.city}</p>}
              {specs && <p className="text-xs text-neutral-600">{specs}</p>}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-neutral-500 hover:bg-neutral-200"
                aria-label="Cerrar detalle"
              >
                ×
              </button>
            )}
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <p className="text-xl font-bold tabular-nums text-neutral-950">
              {resolved.price.toLocaleString("es-ES")} €
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <SaveListingButton listingId={resolved.id} compact />
              {displayRoi != null && (
                <span className="rounded-md bg-neutral-950 px-2 py-0.5 text-xs font-bold text-white tabular-nums">
                  {displayRoi.toFixed(2)}% ROI
                </span>
              )}
            </div>
          </div>
          {resolved.sourceUrl && (
            <a
              href={resolved.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[11px] font-medium text-neutral-700 underline"
            >
              Ver anuncio en {portal.name}
            </a>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          <button type="button" className={tabClass(tab === "resumen")} onClick={() => setTab("resumen")}>
            Resumen
          </button>
          <button type="button" className={tabClass(tab === "notariado")} onClick={() => setTab("notariado")}>
            Notariado
          </button>
          <button type="button" className={tabClass(tab === "ia")} onClick={() => setTab("ia")}>
            Análisis IA
          </button>
          <button type="button" className={tabClass(tab === "roi")} onClick={() => setTab("roi")}>
            ROI
          </button>
          <Link
            href={`/app/listings/${resolved.id}`}
            className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-200/80"
          >
            Ficha →
          </Link>
        </nav>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "resumen" && (
          <>
            {summaryLoading && !summary && (
              <div className="animate-pulse space-y-3 p-4">
                <div className="h-4 w-3/4 rounded bg-neutral-200" />
                <div className="h-24 rounded bg-neutral-200" />
                <div className="h-32 rounded bg-neutral-200" />
              </div>
            )}
            {summary && (
              <ListingResumenPanel summary={summary} listingId={resolved.id} embedded showAi={false} />
            )}
            {!summaryLoading && !summary && (
              <p className="p-4 text-xs text-neutral-500">No hay métricas de mercado para este anuncio.</p>
            )}
          </>
        )}
        {tab === "notariado" && (
          <div className="p-3">
            {summary?.notary?.portal ? (
              <NotariadoPortalPanel portal={summary.notary.portal} />
            ) : summaryLoading ? (
              <p className="text-xs text-neutral-500">Cargando notariado…</p>
            ) : (
              <p className="text-xs text-neutral-600">
                Sin informe del Portal del Notariado para CP{" "}
                {summary?.postalCode ?? "—"}. Ejecuta el job{" "}
                <code className="text-[10px]">sync-notary-barcelona-cp</code> o importa JSON desde penotariado.com.
              </p>
            )}
          </div>
        )}
        {tab === "ia" && (
          <div className="p-3">
            <ListingAiAnalysisBlock listingId={resolved.id} autoLoadCache />
          </div>
        )}
        {tab === "roi" && (
          <div className="space-y-3 p-3">
            {summary ? (
              <>
                <p className="text-xs text-neutral-600">
                  Modelo buy-to-let con ITP incluido. Ajusta hipoteca y gastos en la calculadora pro.
                </p>
                <div className="overflow-hidden rounded-lg border border-neutral-200">
                  <ListingResumenPanel summary={summary} listingId={resolved.id} embedded showAi={false} />
                </div>
              </>
            ) : (
              <p className="text-sm text-neutral-600">Cargando modelo ROI…</p>
            )}
            <Link
              href="/app/calculator"
              className="inline-block rounded-lg bg-neutral-950 px-3 py-2 text-xs font-medium text-white"
            >
              Calculadora completa
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
