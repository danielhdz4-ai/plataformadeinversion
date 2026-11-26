"use client";

import { ListingAiAnalysisBlock } from "@/components/listings/ListingAiAnalysisBlock";
import { InteractiveMarketChart } from "@/components/listings/InteractiveMarketChart";
import {
  OpportunityScoreBadge,
  SellerKindBadge,
  PriceVsValuationHeadline,
} from "@/components/listings/OpportunityBadges";
import { ListingResumenPanel } from "@/components/listings/ListingResumenPanel";
import { BeforeBuyingBlock, DealNumbersBlock } from "@/components/listings/DealNarrativeBlocks";
import { MetricCard, MetricRow } from "@/components/ui/MetricCard";
import { NeighborhoodGauge } from "@/components/listings/NeighborhoodGauge";
import { NotariadoPortalPanel } from "@/components/notariado/NotariadoPortalPanel";
import { PriceValuationSlider } from "@/components/listings/PriceValuationSlider";
import { SaveListingButton } from "@/components/listings/SaveListingButton";
import { cleanListingTitle } from "@/lib/listing/display-title";
import type { ListingSummary } from "@/lib/listing/summary-types";
import { portalBadge } from "@/lib/portals";
import Link from "next/link";
import { useState } from "react";

export type ListingDetailData = {
  id: string;
  title: string;
  property_kind?: string | null;
  price: number;
  source_url: string;
  source_portal: string;
  city: string;
  postal_code: string;
  sqm: number;
  bedrooms: number;
  bathrooms?: number;
  thumbnail_url?: string | null;
  investment?: {
    rent_est: number;
    roi_gross: number;
    rent_confidence: string;
    comparables_count: number;
  };
  enrichment?: { rc: string | null; catastral_surface: number | null; year_built: number | null };
  scraped_at?: string | null;
};

type Tab = "resumen" | "inversion" | "mercado" | "catastro";

function proxiedThumb(url: string | null | undefined) {
  if (!url) return null;
  if (url.includes("pisos.com") || url.includes("kelify.com")) {
    return `/api/image-proxy?u=${encodeURIComponent(url)}`;
  }
  return url;
}

export function ListingDetailFullView({
  listing,
  summary,
  summaryLoading,
  backHref,
  backLabel,
  onEnrichCatastro,
  enriching,
  enrichError,
}: {
  listing: ListingDetailData;
  summary: ListingSummary | null;
  summaryLoading?: boolean;
  backHref: string;
  backLabel: string;
  onEnrichCatastro: () => void;
  enriching: boolean;
  enrichError: string | null;
}) {
  const [tab, setTab] = useState<Tab>("resumen");
  const portal = portalBadge(listing.source_portal);
  const imgSrc = proxiedThumb(listing.thumbnail_url);
  const price = Number(listing.price);
  const roi = summary?.roi.grossRoiPct ?? listing.investment?.roi_gross ?? null;
  const listingM2 = summary?.pricePerSqm ?? (listing.sqm > 0 ? price / listing.sqm : null);

  const specs = [
    listing.bedrooms != null ? `${listing.bedrooms} dorm.` : null,
    listing.bathrooms != null ? `${listing.bathrooms} baños` : null,
    listing.sqm != null ? `${listing.sqm} m²` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const calcHref = `/app/calculator?price=${Math.round(price)}&rent=${Math.round(summary?.roi.rentEstMonthly ?? listing.investment?.rent_est ?? 0)}`;

  const tabs: { id: Tab; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "inversion", label: "Inversión" },
    { id: "mercado", label: "Mercado" },
    { id: "catastro", label: "Catastro" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-neutral-100 lg:flex-row">
      <div className="relative flex min-h-[38vh] shrink-0 flex-col lg:min-h-0 lg:w-[min(44vw,560px)] lg:border-r lg:border-neutral-200">
        <div className="absolute inset-0 bg-neutral-900">
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgSrc} alt="" className="h-full w-full object-cover opacity-95" />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950 text-neutral-500">
              Sin imagen
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-between p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <Link
              href={backHref}
              className="rounded-lg bg-black/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/55"
            >
              ← {backLabel}
            </Link>
            <SaveListingButton listingId={listing.id} compact />
          </div>

          <div className="mt-auto space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {summary?.opportunity && (
                <>
                  <SellerKindBadge kind={summary.opportunity.sellerKind} />
                  <OpportunityScoreBadge score={summary.opportunity.opportunityScore} />
                </>
              )}
              <span className="rounded-full bg-void/60 px-2.5 py-1 text-[10px] font-bold uppercase text-ink backdrop-blur">
                {portal.name}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-3xl">
              {cleanListingTitle(listing.title, listing.property_kind ?? null)}
            </h1>
            <p className="text-sm text-ink-muted">
              {listing.city} · CP {listing.postal_code}
              {specs ? ` · ${specs}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-void">
        <div className="shrink-0 border-b border-line bg-deep px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <PriceVsValuationHeadline
                price={price}
                valuationMid={summary?.opportunity.valuationMid ?? null}
                valuationLow={summary?.opportunity.valuationLow ?? null}
                valuationHigh={summary?.opportunity.valuationHigh ?? null}
                discountPct={summary?.opportunity.discountPct ?? null}
                propertyLabel="esta vivienda"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {roi != null && (
                <div className="rounded-xl border border-line bg-surface px-4 py-2 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">ROI bruto</p>
                  <p className="text-xl font-extrabold tabular-nums text-lime">{roi.toFixed(2)} %</p>
                </div>
              )}
              {listingM2 != null && (
                <div className="rounded-xl border border-line bg-surface px-4 py-2 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">Anuncio</p>
                  <p className="text-lg font-extrabold tabular-nums text-ink">
                    {Math.round(listingM2).toLocaleString("es-ES")} €/m²
                  </p>
                </div>
              )}
              <a
                href={listing.source_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-lime px-4 py-2.5 text-sm font-bold text-lime-ink transition hover:brightness-105"
              >
                Ver en {portal.name}
              </a>
            </div>
          </div>
          {summary?.opportunity && (
            <div className="mt-4">
              <PriceValuationSlider price={price} metrics={summary.opportunity} />
            </div>
          )}
        </div>

        <div className="shrink-0 border-b border-line bg-deep px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex gap-1 overflow-x-auto py-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  tab === t.id
                    ? "bg-lime text-lime-ink"
                    : "text-ink-muted hover:bg-raised hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          {summary && (
            <div className="mb-6">
              <InteractiveMarketChart summary={summary} listingPriceM2={listingM2} />
            </div>
          )}
          {summaryLoading && !summary && (
            <p className="mb-6 rounded-xl border border-line bg-surface p-6 text-sm text-ink-muted">
              Cargando métricas de mercado…
            </p>
          )}

          {tab === "resumen" && (
            <div className="space-y-6">
              <ListingAiAnalysisBlock listingId={listing.id} autoLoadCache />
              {summary && (
                <>
                  <DealNumbersBlock summary={summary} price={price} />
                  <BeforeBuyingBlock summary={summary} price={price} />
                  <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                    <ListingResumenPanel summary={summary} listingId={listing.id} embedded showAi={false} />
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "inversion" && (
            <div className="space-y-4">
              {summary ? (
                <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                  <ListingResumenPanel summary={summary} listingId={listing.id} embedded showAi={false} />
                </div>
              ) : listing.investment ? (
                <div className="grid gap-2 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-3">
                  <MetricCard
                    label="Renta estimada"
                    value={String(listing.investment.rent_est ?? "—")}
                    unit="€/mes"
                  />
                  <MetricCard
                    label="ROI bruto"
                    value={listing.investment.roi_gross?.toFixed(2) ?? "—"}
                    unit="%"
                  />
                  <MetricCard
                    label="Confianza"
                    value={listing.investment.rent_confidence ?? "—"}
                    sub={`${listing.investment.comparables_count} comparables`}
                  />
                </div>
              ) : null}
              <Link
                href={calcHref}
                className="inline-flex rounded-full bg-lime px-5 py-3 text-sm font-bold text-lime-ink"
              >
                Calculadora completa →
              </Link>
            </div>
          )}

          {tab === "mercado" && (
            <div className="space-y-6">
              {summary?.neighborhood.listingPriceM2 != null && summary.neighborhood.cpAvgPriceM2 != null && (
                <section className="brasa-card p-5">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
                    Posición vs media del CP
                  </h3>
                  <div className="mt-4">
                    <NeighborhoodGauge
                      listingM2={summary.neighborhood.listingPriceM2}
                      cpAvgM2={summary.neighborhood.cpAvgPriceM2}
                      vsPct={summary.neighborhood.vsCpPct}
                    />
                  </div>
                </section>
              )}
              {summary?.notary?.portal ? (
                <NotariadoPortalPanel portal={summary.notary.portal} />
              ) : summary?.notary ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <MetricCard
                    label="Precio medio por m²"
                    value={summary.notary.priceM2 != null ? summary.notary.priceM2.toLocaleString("es-ES") : "—"}
                    unit="€/m²"
                  />
                  <MetricCard
                    label="Compraventas"
                    value={summary.notary.operationsCount != null ? String(summary.notary.operationsCount) : "—"}
                    sub={summary.notary.period ? `Periodo ${summary.notary.period}` : undefined}
                  />
                </div>
              ) : (
                <p className="text-sm text-ink-muted">Sin datos notariales para este CP.</p>
              )}
            </div>
          )}

          {tab === "catastro" && (
            <section className="brasa-card p-6">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink">Catastro</h3>
              {listing.enrichment?.rc ? (
                <div className="mt-3 space-y-1">
                  <MetricRow label="Referencia catastral" value={listing.enrichment.rc} />
                  {listing.enrichment.catastral_surface != null && (
                    <MetricRow
                      label="Superficie catastral"
                      value={`${listing.enrichment.catastral_surface} m²`}
                    />
                  )}
                  {listing.enrichment.year_built != null && (
                    <MetricRow label="Año de construcción" value={String(listing.enrichment.year_built)} />
                  )}
                </div>
              ) : (
                <>
                  <p className="mt-2 text-sm text-ink-muted">Datos catastrales pendientes.</p>
                  {enrichError && (
                    <p className="mt-2 rounded-lg border border-clay/40 bg-clay/10 px-3 py-2 text-sm text-clay">
                      {enrichError}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={enriching}
                    onClick={onEnrichCatastro}
                    className="mt-4 rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:border-lime/60 hover:text-lime disabled:opacity-50"
                  >
                    {enriching ? "Consultando OVC…" : "Enriquecer (Catastro OVC)"}
                  </button>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
