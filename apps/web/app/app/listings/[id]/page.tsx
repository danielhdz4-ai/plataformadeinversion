"use client";

import { ListingAiAnalysisBlock } from "@/components/listings/ListingAiAnalysisBlock";
import { ListingResumenPanel } from "@/components/listings/ListingResumenPanel";
import { AppScrollPage } from "@/components/app/AppScrollPage";
import { Badge } from "@/components/ui/Badge";
import { decodeListingTitle } from "@/lib/decode-html";
import type { ListingSummary } from "@/lib/listing/summary-types";
import { portalBadge } from "@/lib/portals";
import {
  defaultReturnPath,
  returnNavLabel,
  sanitizeReturnPath,
} from "@/lib/listing/return-navigation";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

type Tab = "resumen" | "roi" | "barrio";

function ListingDetailPageContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const backHref = sanitizeReturnPath(searchParams.get("from")) ?? defaultReturnPath();
  const backLabel = returnNavLabel(backHref);
  const [tab, setTab] = useState<Tab>("resumen");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ListingSummary | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    const res = await fetch(`/api/listings/${id}`);
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok || body.error) {
      setData(null);
      setLoadError(
        res.status === 404
          ? "Este inmueble no existe o ya no está activo."
          : String(body.error ?? "Error al cargar la ficha.")
      );
      return;
    }
    setData(body);
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/listings/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok || cancelled) return;
      const body = (await res.json()) as { summaries: Record<string, ListingSummary> };
      if (!cancelled) setSummary(body.summaries?.[id] ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function enrichCatastro() {
    setEnriching(true);
    setEnrichError(null);
    const res = await fetch(`/api/listings/${id}/enrich`, { method: "POST" });
    const body = (await res.json()) as { error?: string; rc?: string };
    setEnriching(false);
    if (!res.ok) {
      setEnrichError(
        body.error ??
          (res.status === 400
            ? "Este anuncio no tiene ubicación en mapa (falta geolocalización)."
            : "No se pudo consultar Catastro. Inténtalo de nuevo.")
      );
      return;
    }
    void reload();
  }

  if (loadError) {
    return (
      <AppScrollPage>
        <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
          <p className="text-neutral-800">{loadError}</p>
          <Link href={backHref} className="text-sm font-medium text-neutral-950 underline">
            ← {backLabel}
          </Link>
        </div>
      </AppScrollPage>
    );
  }

  if (!data) {
    return (
      <AppScrollPage>
        <p className="text-neutral-600">Cargando ficha…</p>
      </AppScrollPage>
    );
  }

  const listing = data as {
    title: string;
    price: number;
    source_url: string;
    source_portal: string;
    city: string;
    postal_code: string;
    sqm: number;
    bedrooms: number;
    bathrooms?: number;
    thumbnail_url?: string | null;
    investment?: { rent_est: number; roi_gross: number; rent_confidence: string; comparables_count: number };
    enrichment?: { rc: string | null; catastral_surface: number | null; year_built: number | null };
    notary?: {
      price_m2: number;
      avg_price: number;
      avg_surface: number;
      operations_count: number;
      period: string;
      es_estimado: boolean;
    } | null;
    officialMarket?: { source: string; period: string; metrics: Record<string, unknown> }[];
    scraped_at?: string | null;
  };

  const portal = portalBadge(listing.source_portal);
  const tabs: { id: Tab; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "roi", label: "ROI" },
    { id: "barrio", label: "Barrio · Oficial" },
  ];

  const tabBtn = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${
      active ? "bg-neutral-950 text-white" : "text-neutral-600 hover:bg-white"
    }`;

  const specs = [
    listing.bedrooms != null ? `${listing.bedrooms} dorm.` : null,
    listing.bathrooms != null ? `${listing.bathrooms} baños` : null,
    listing.sqm != null ? `${listing.sqm} m²` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppScrollPage>
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href={backHref} className="text-sm font-medium text-neutral-700 underline">
          ← {backLabel}
        </Link>
        <header className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {listing.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                listing.thumbnail_url.includes("pisos.com") || listing.thumbnail_url.includes("kelify.com")
                  ? `/api/image-proxy?u=${encodeURIComponent(listing.thumbnail_url)}`
                  : listing.thumbnail_url
              }
              alt=""
              className="h-56 w-full object-cover sm:h-72"
            />
          )}
          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{portal.name}</Badge>
                  {listing.scraped_at && (
                    <Badge tone="neutral">
                      Datos {new Date(listing.scraped_at).toLocaleDateString("es-ES")}
                    </Badge>
                  )}
                </div>
                <h1 className="mt-2 text-2xl font-semibold text-neutral-950">
                  {decodeListingTitle(listing.title)}
                </h1>
                <p className="text-neutral-600">
                  {listing.city} · CP {listing.postal_code}
                </p>
                {specs && <p className="mt-1 text-sm text-neutral-700">{specs}</p>}
              </div>
              <p className="text-2xl font-bold tabular-nums text-neutral-950">
                {Number(listing.price).toLocaleString("es-ES")} €
              </p>
            </div>
            <a
              href={listing.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white"
            >
              Ver anuncio en {portal.name}
            </a>
          </div>
        </header>

        <nav className="flex flex-wrap gap-2 border-b border-neutral-200 pb-2">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={tabBtn(tab === t.id)}>
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "resumen" && (
          <section className="space-y-4">
            <ListingAiAnalysisBlock listingId={id} autoLoadCache />
            {summary ? (
              <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <ListingResumenPanel summary={summary} listingId={id} showAi={false} />
              </div>
            ) : (
              <p className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
                Cargando métricas de mercado…
              </p>
            )}
          </section>
        )}

        {tab === "roi" && (
          <section className="space-y-4">
            {summary ? (
              <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <div className="border-b border-neutral-100 bg-[#faf9f7] px-4 py-3">
                  <h2 className="text-sm font-semibold text-neutral-950">Modelo buy-to-let</h2>
                </div>
                <ListingResumenPanel summary={summary} listingId={id} embedded showAi={false} />
              </div>
            ) : listing.investment ? (
              <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-6 text-sm">
                <p>Renta estimada: {listing.investment.rent_est} €/mes</p>
                <p>ROI bruto: {listing.investment.roi_gross?.toFixed(2)} %</p>
                <p>
                  Confianza: {listing.investment.rent_confidence} ({listing.investment.comparables_count}{" "}
                  comparables)
                </p>
              </div>
            ) : (
              <p className="text-sm text-neutral-600">Sin modelo de inversión para este anuncio.</p>
            )}
            <Link
              href="/app/calculator"
              className="inline-block rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-950"
            >
              Abrir calculadora completa (hipoteca, Airbnb, flip) →
            </Link>
          </section>
        )}

        {tab === "barrio" && (
          <section className="space-y-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <h2 className="font-semibold text-neutral-950">Catastro</h2>
              {listing.enrichment?.rc ? (
                <dl className="mt-2 space-y-1 text-sm text-neutral-700">
                  <div>Referencia catastral: {listing.enrichment.rc}</div>
                  {listing.enrichment.catastral_surface != null && (
                    <div>Superficie catastral: {listing.enrichment.catastral_surface} m²</div>
                  )}
                  {listing.enrichment.year_built != null && (
                    <div>Año construcción: {listing.enrichment.year_built}</div>
                  )}
                </dl>
              ) : (
                <>
                  <p className="mt-2 text-sm text-neutral-600">Datos catastrales pendientes.</p>
                  {enrichError && (
                    <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                      {enrichError}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={enriching}
                    onClick={enrichCatastro}
                    className="mt-3 rounded-lg border border-neutral-300 bg-[#f7f6f3] px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {enriching ? "Consultando OVC…" : "Enriquecer (Catastro OVC)"}
                  </button>
                </>
              )}
            </div>
            {summary && (
              <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <ListingResumenPanel summary={summary} listingId={id} embedded showAi={false} />
              </div>
            )}
          </section>
        )}
      </div>
    </AppScrollPage>
  );
}

export default function ListingDetailPage() {
  return (
    <Suspense fallback={<AppScrollPage><p className="p-8 text-sm text-neutral-600">Cargando ficha…</p></AppScrollPage>}>
      <ListingDetailPageContent />
    </Suspense>
  );
}
