"use client";

import { ListingAiAnalysisBlock } from "@/components/listings/ListingAiAnalysisBlock";
import { ListingResumenPanel } from "@/components/listings/ListingResumenPanel";
import { NeighborhoodGauge } from "@/components/listings/NeighborhoodGauge";
import { MetricCard, MetricSection } from "@/components/ui/MetricCard";
import { RoomRentComparablesPanel } from "@/components/listings/RoomRentComparablesPanel";
import { NotariadoPortalPanel } from "@/components/notariado/NotariadoPortalPanel";
import { decodeListingTitle } from "@/lib/decode-html";
import { cleanListingTitle } from "@/lib/listing/display-title";
import { resolveListingSqm } from "@/lib/listing/resolve-sqm";
import type { ListingSummary } from "@/lib/listing/summary-types";
import { portalBadge } from "@/lib/portals";
import { SaveListingButton } from "@/components/listings/SaveListingButton";
import {
  OpportunityScoreBadge,
  SellerKindBadge,
  ValuationSnippet,
} from "@/components/listings/OpportunityBadges";
import { PriceValuationSlider } from "@/components/listings/PriceValuationSlider";
import { computeOpportunityMetrics } from "@/lib/listing/opportunity-metrics";
import { listingDetailHref } from "@/lib/listing/return-navigation";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export type SidePanelListing = {
  id: string;
  title: string | null;
  propertyKind?: string | null;
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
  detailLoading,
  onClose,
  onSummaryModeChange,
  summaryMode = "whole",
  preferRoomsTab = false,
  showEmptyState = true,
}: {
  listing: SidePanelListing | null;
  summary: ListingSummary | null;
  summaryLoading?: boolean;
  /** Carga del resumen completo (notariado, INE, habitaciones). */
  detailLoading?: boolean;
  onClose?: () => void;
  /** Al abrir «Habitaciones», pedir resumen con comparables de habitación. */
  onSummaryModeChange?: (mode: "whole" | "rooms") => void;
  summaryMode?: "whole" | "rooms";
  preferRoomsTab?: boolean;
  /** En feed ancho: ocultar columna vacía hasta que haya selección. */
  showEmptyState?: boolean;
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
    `shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
      active ? "bg-lime text-lime-ink" : "text-ink-muted hover:bg-raised hover:text-ink"
    }`;

  const panelShell =
    "flex min-h-0 shrink-0 flex-col border-l border-line bg-deep w-full max-w-md xl:h-full xl:w-[min(400px,32vw)] xl:max-w-none xl:overflow-hidden";

  if (!resolved) {
    if (!showEmptyState) return null;
    return (
      <aside className={`hidden xl:flex ${panelShell}`}>
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <p className="text-sm font-semibold text-ink">Detalle del inmueble</p>
          <p className="mt-2 max-w-xs text-xs text-ink-muted">
            Selecciona un piso en el mapa o en la lista para ver resumen, ROI, comparables y análisis.
          </p>
        </div>
      </aside>
    );
  }

  const portal = portalBadge(resolved.sourcePortal);
  const title = cleanListingTitle(resolved.title ?? "Inmueble", resolved.propertyKind ?? null);
  const imgSrc = proxiedThumb(resolved.thumbnailUrl);
  const effectiveSqm = resolveListingSqm(resolved.sqm, resolved.title);
  const specs = [
    resolved.bedrooms != null ? `${resolved.bedrooms} hab.` : null,
    resolved.bathrooms != null ? `${resolved.bathrooms} baños` : null,
    effectiveSqm != null ? `${effectiveSqm} m²` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const displayRoi = summary?.roi.grossRoiPct ?? resolved.roi ?? null;
  const opportunity =
    summary?.opportunity ??
    computeOpportunityMetrics(
      {
        price: resolved.price,
        sqm: effectiveSqm,
        roi: displayRoi,
        sourcePortal: resolved.sourcePortal,
        title: resolved.title,
        sourceUrl: resolved.sourceUrl,
      },
      summary
    );

  return (
    <aside
      className={`${panelShell} fixed inset-y-0 right-0 z-50 shadow-2xl xl:static xl:z-auto xl:shadow-none`}
    >
      <div className="shrink-0 border-b border-line bg-deep">
        {imgSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc} alt="" className="h-36 w-full object-cover" />
        )}
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-ink px-2 py-0.5 text-[9px] font-bold uppercase text-void">
                  En venta
                </span>
                <SellerKindBadge kind={opportunity.sellerKind} />
                <OpportunityScoreBadge score={opportunity.opportunityScore} />
                <span className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{portal.name}</span>
                {resolved.rank != null && (
                  <span className="text-[10px] text-ink-muted">#{resolved.rank} ranking</span>
                )}
              </div>
              <h2 className="mt-1 line-clamp-2 text-sm font-bold capitalize text-ink">{title}</h2>
              {resolved.city && (
                <p className="text-xs text-ink-muted">{decodeListingTitle(resolved.city)}</p>
              )}
              {specs && <p className="text-xs text-ink-muted">{specs}</p>}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-ink-muted transition hover:bg-raised hover:text-ink"
                aria-label="Cerrar detalle"
              >
                ×
              </button>
            )}
          </div>
          <div className="mt-2 space-y-2">
            <ValuationSnippet
              price={resolved.price}
              valuationMid={opportunity.valuationMid}
              discountPct={opportunity.discountPct}
            />
            <div className="flex items-end justify-between gap-2">
              {opportunity.valuationMid == null && (
                <p className="text-xl font-extrabold tabular-nums text-ink">
                  {resolved.price.toLocaleString("es-ES")} €
                </p>
              )}
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <SaveListingButton listingId={resolved.id} compact />
                {displayRoi != null && (
                  <span className="rounded-full bg-lime px-2.5 py-1 text-xs font-bold tabular-nums text-lime-ink">
                    {displayRoi.toFixed(2)} % ROI
                  </span>
                )}
              </div>
            </div>
            <PriceValuationSlider price={resolved.price} metrics={opportunity} />
          </div>
          <Link
            href={listingDetailHref(resolved.id, returnTo)}
            className="mt-2 inline-block text-[11px] font-semibold text-lime hover:underline"
          >
            Ficha completa y calculadora →
          </Link>
          {resolved.sourceUrl && (
            <a
              href={resolved.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[11px] font-medium text-ink-muted underline hover:text-ink"
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
          </button>          <button type="button" className={tabClass(tab === "notariado")} onClick={() => setTab("notariado")}>
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
            className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-lime hover:bg-raised"
          >
            Ficha →
          </Link>
        </nav>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-void">
        {tab === "resumen" && (
          <>
            {summaryLoading && !summary && (
              <div className="space-y-3 p-3">
                <div className="shimmer h-4 w-3/4 rounded" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="shimmer h-20 rounded-xl" />
                  <div className="shimmer h-20 rounded-xl" />
                </div>
                <div className="shimmer h-32 rounded-xl" />
              </div>
            )}
            {summary && (
              <div className="p-3">
                <ListingResumenPanel summary={summary} listingId={resolved.id} embedded showAi={false} />
              </div>
            )}
            {summaryLoading && summary && (
              <p className="px-4 pt-2 text-[10px] text-ink-muted">Completando comparables y datos INE…</p>
            )}
            {!summaryLoading && !summary && (
              <p className="p-4 text-xs text-ink-muted">No hay métricas de mercado para este anuncio.</p>
            )}
          </>
        )}
        {tab === "habitaciones" && (
          <div className="space-y-3 p-3">
            {(summaryLoading || detailLoading) && summaryMode === "rooms" && !summary?.roomRent && (
              <div className="space-y-3">
                <div className="shimmer h-24 rounded-2xl" />
                <div className="shimmer h-32 rounded-2xl" />
              </div>
            )}
            {summary?.roomRent && summaryMode === "rooms" ? (
              <>
                {summary.priceEvolution && (
                  <MetricSection title="Evolución · mercado local">
                    <div className="grid gap-2 pb-1">
                      <MetricCard
                        label="Venta €/m²"
                        value={
                          summary.priceEvolution.saleM2.at(-1)?.y != null
                            ? Math.round(summary.priceEvolution.saleM2.at(-1)!.y).toLocaleString("es-ES")
                            : "—"
                        }
                        unit="€/m²"
                        size="sm"
                        delta={`${summary.priceEvolution.saleChangePct.toFixed(1)} %`}
                        deltaTone={summary.priceEvolution.saleChangePct >= 0 ? "good" : "bad"}
                        series={summary.priceEvolution.saleM2}
                      />
                      <MetricCard
                        label="Alquiler €/m²"
                        value={
                          summary.priceEvolution.rentM2.at(-1)?.y != null
                            ? summary.priceEvolution.rentM2.at(-1)!.y.toFixed(1)
                            : "—"
                        }
                        unit="€/m²·mes"
                        size="sm"
                        delta={`${summary.priceEvolution.rentChangePct.toFixed(1)} %`}
                        deltaTone={summary.priceEvolution.rentChangePct >= 0 ? "good" : "bad"}
                        series={summary.priceEvolution.rentM2}
                      />
                    </div>
                  </MetricSection>
                )}
                {summary.neighborhood.listingPriceM2 != null &&
                  summary.neighborhood.cpAvgPriceM2 != null && (
                    <MetricSection title="Posición en el barrio">
                      <div className="grid grid-cols-2 gap-2 pb-2">
                        <MetricCard
                          label="Este inmueble"
                          value={summary.neighborhood.listingPriceM2.toLocaleString("es-ES", {
                            maximumFractionDigits: 0,
                          })}
                          unit="€/m²"
                          size="sm"
                          delta={
                            summary.neighborhood.vsCpPct != null
                              ? `${summary.neighborhood.vsCpPct > 0 ? "+" : ""}${summary.neighborhood.vsCpPct.toFixed(1)} %`
                              : null
                          }
                          deltaTone={(summary.neighborhood.vsCpPct ?? 0) <= 0 ? "good" : "bad"}
                        />
                        <MetricCard
                          label="Media del CP"
                          value={summary.neighborhood.cpAvgPriceM2.toLocaleString("es-ES", {
                            maximumFractionDigits: 0,
                          })}
                          unit="€/m²"
                          size="sm"
                        />
                      </div>
                      <NeighborhoodGauge
                        listingM2={summary.neighborhood.listingPriceM2}
                        cpAvgM2={summary.neighborhood.cpAvgPriceM2}
                        vsPct={summary.neighborhood.vsCpPct}
                      />
                    </MetricSection>
                  )}
                <RoomRentComparablesPanel
                  comparables={summary.roomRent.comparables}
                  estimatePerRoom={summary.roomRent.estimatePerRoom}
                  conservativePerRoom={summary.roomRent.conservativePerRoom}
                  bedrooms={summary.roomRent.bedrooms}
                />
              </>
            ) : summaryMode === "rooms" && !summaryLoading && !detailLoading ? (
              <p className="text-xs text-ink-muted">
                No hay habitaciones en alquiler cerca de este inmueble. Prueba otra zona o espera al scrape de
                alquileres.
              </p>
            ) : summaryMode !== "rooms" ? (
              <p className="text-xs text-ink-muted">Cargando comparables de habitación…</p>
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

