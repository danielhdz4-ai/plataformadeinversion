"use client";

import { ListingAiAnalysisBlock } from "@/components/listings/ListingAiAnalysisBlock";
import { ListingResumenPanel } from "@/components/listings/ListingResumenPanel";
import { PriceTrendChart } from "@/components/listings/PriceTrendChart";
import { NeighborhoodGauge } from "@/components/listings/NeighborhoodGauge";
import { RoomRentComparablesPanel } from "@/components/listings/RoomRentComparablesPanel";
import { NotariadoPortalPanel } from "@/components/notariado/NotariadoPortalPanel";
import { decodeListingTitle } from "@/lib/decode-html";
import type { ListingSummary } from "@/lib/listing/summary-types";
import { portalBadge } from "@/lib/portals";
import { SaveListingButton } from "@/components/listings/SaveListingButton";
import { listingDetailHref } from "@/lib/listing/return-navigation";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

type Tab = "resumen" | "habitaciones" | "notariado" | "ia" | "roi";

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
  onSummaryModeChange,
  summaryMode = "whole",
  preferRoomsTab = false,
}: {
  listing: SidePanelListing | null;
  summary: ListingSummary | null;
  summaryLoading?: boolean;
  onClose?: () => void;
  /** Al abrir «Habitaciones», pedir resumen con comparables de habitación. */
  onSummaryModeChange?: (mode: "whole" | "rooms") => void;
  summaryMode?: "whole" | "rooms";
  preferRoomsTab?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("resumen");
  const [fetched, setFetched] = useState<SidePanelListing | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = useMemo(() => {
    const q = searchParams.toString();
    return q ? `${pathname}?${q}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    setTab(preferRoomsTab ? "habitaciones" : "resumen");
    setFetched(null);
    if (preferRoomsTab) onSummaryModeChange?.("rooms");
  }, [listing?.id, preferRoomsTab, onSummaryModeChange]);

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
      className={`${panelShell} fixed inset-y-0 right-0 z-50 shadow-2xl xl:static xl:z-auto xl:shadow-none`}
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
              {resolved.city && (
                <p className="text-xs text-neutral-500">{decodeListingTitle(resolved.city)}</p>
              )}
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
          <button
            type="button"
            className={tabClass(tab === "habitaciones")}
            onClick={() => {
              onSummaryModeChange?.("rooms");
              setTab("habitaciones");
            }}
          >
            Habitaciones
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
            href={listingDetailHref(resolved.id, returnTo)}
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
        {tab === "habitaciones" && (
          <div className="space-y-3 bg-[#faf9f7] p-3">
            {(summaryLoading || summaryMode !== "rooms") && !summary?.roomRent && (
              <div className="animate-pulse space-y-3">
                <div className="h-24 rounded-lg bg-neutral-200" />
                <div className="h-48 rounded-xl bg-neutral-800" />
              </div>
            )}
            {summary?.roomRent && summaryMode === "rooms" ? (
              <>
                {summary.priceEvolution && (
                  <section className="rounded-lg border border-neutral-200 bg-white p-2.5">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      Evolución de precios — mercado local
                    </h4>
                    <div className="mt-2 grid gap-3">
                      <div>
                        <div className="mb-1 flex items-baseline justify-between gap-1">
                          <span className="text-[11px] font-medium text-neutral-800">Venta €/m²</span>
                          <span className="text-[11px] tabular-nums text-neutral-950">
                            {summary.priceEvolution.saleM2.at(-1)?.y != null
                              ? `${Math.round(summary.priceEvolution.saleM2.at(-1)!.y).toLocaleString("es-ES")} €`
                              : "—"}
                            <span className="ml-1 text-emerald-700">
                              +{summary.priceEvolution.saleChangePct.toFixed(1)}%
                            </span>
                          </span>
                        </div>
                        <PriceTrendChart points={summary.priceEvolution.saleM2} />
                      </div>
                      <div>
                        <div className="mb-1 flex items-baseline justify-between gap-1">
                          <span className="text-[11px] font-medium text-neutral-800">Alquiler €/m²/mes</span>
                          <span className="text-[11px] tabular-nums text-neutral-950">
                            {summary.priceEvolution.rentM2.at(-1)?.y != null
                              ? `${summary.priceEvolution.rentM2.at(-1)!.y.toFixed(1)} €`
                              : "—"}
                            <span className="ml-1 text-emerald-700">
                              +{summary.priceEvolution.rentChangePct.toFixed(1)}%
                            </span>
                          </span>
                        </div>
                        <PriceTrendChart
                          points={summary.priceEvolution.rentM2}
                          stroke="#525252"
                          fill="rgba(82,82,82,0.12)"
                        />
                      </div>
                    </div>
                  </section>
                )}
                {summary.neighborhood.listingPriceM2 != null &&
                  summary.neighborhood.cpAvgPriceM2 != null && (
                    <section className="rounded-lg border border-neutral-200 bg-white p-2.5">
                      <h4 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                        Resumen del barrio (€/m²)
                      </h4>
                      <div className="mt-2">
                        <NeighborhoodGauge
                          listingM2={summary.neighborhood.listingPriceM2}
                          cpAvgM2={summary.neighborhood.cpAvgPriceM2}
                          vsPct={summary.neighborhood.vsCpPct}
                        />
                      </div>
                    </section>
                  )}
                <RoomRentComparablesPanel
                  comparables={summary.roomRent.comparables}
                  estimatePerRoom={summary.roomRent.estimatePerRoom}
                  conservativePerRoom={summary.roomRent.conservativePerRoom}
                  bedrooms={summary.roomRent.bedrooms}
                />
              </>
            ) : summaryMode === "rooms" && !summaryLoading ? (
              <p className="text-xs text-neutral-600">
                No hay habitaciones en alquiler cerca de este inmueble. Prueba otra zona o espera al scrape de
                alquileres.
              </p>
            ) : null}
          </div>
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
