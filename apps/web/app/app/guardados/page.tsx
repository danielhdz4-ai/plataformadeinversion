"use client";

import { AppScrollPage } from "@/components/app/AppScrollPage";
import {
  ListingFiltersPanel,
  type ListingSort,
} from "@/components/filters/ListingFiltersPanel";
import { SaveListingButton } from "@/components/listings/SaveListingButton";
import { decodeListingTitle } from "@/lib/decode-html";
import { applyListingViewPipeline } from "@/lib/listing/apply-opportunity-view";
import { useListingSummaries } from "@/lib/listing/use-listing-summaries";
import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";
import { defaultListingFilters } from "@/lib/scan/listing-filter-defaults";
import { portalBadge } from "@/lib/portals";
import { ZoneWatchesPanel } from "@/components/zone/ZoneWatchesPanel";
import { AppEmptyState, AppPillButton } from "@/components/ui/AppPage";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SavedListing = {
  id: string;
  title: string;
  price: number;
  source_url: string;
  source_portal?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqm?: number | null;
  city?: string | null;
  listing_investment?:
    | { rent_est: number | null; rent_confidence: string | null; roi_gross: number | null }
    | { rent_est: number | null; rent_confidence: string | null; roi_gross: number | null }[]
    | null;
};

type Saved = { id: string; listing: SavedListing };

function invRow(listing: SavedListing) {
  const inv = Array.isArray(listing.listing_investment) ?
      listing.listing_investment[0]
    : listing.listing_investment;
  return inv;
}

export default function GuardadosPage() {
  const [items, setItems] = useState<Saved[]>([]);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [filters, setFilters] = useState<ScanRunFilters>(() => defaultListingFilters());
  const [sort, setSort] = useState<ListingSort>("score_desc");

  useEffect(() => {
    fetch("/api/saved")
      .then((r) => {
        if (r.status === 401) {
          setNeedsAuth(true);
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d) setItems(d.items ?? []);
      });
  }, []);

  const listingIds = useMemo(() => items.map((s) => s.listing.id).slice(0, 55), [items]);
  const { summaries } = useListingSummaries(listingIds, { mode: "whole" });

  const filtered = useMemo(() => {
    const rows = items
      .map((s) => s.listing)
      .filter(Boolean)
      .map((l) => {
        const inv = invRow(l);
        return {
          ...l,
          id: l.id,
          price: l.price,
          sqm: l.sqm,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          source_portal: l.source_portal,
          title: l.title,
          sourceUrl: l.source_url,
          roi: inv?.roi_gross ?? null,
          rentConfidence: inv?.rent_confidence,
        };
      });
    return applyListingViewPipeline(rows, filters, sort, summaries);
  }, [items, filters, sort, summaries]);

  return (
    <AppScrollPage>
      <h1 className="text-2xl font-semibold text-neutral-950">Guardados</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Oportunidades que marcaste — filtra como en Explorar y Scan.
      </p>

      <ZoneWatchesPanel />

      {needsAuth && (
        <p className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
          <Link href="/login" className="font-medium underline">
            Inicia sesión
          </Link>{" "}
          para ver y sincronizar tus guardados.
        </p>
      )}

      {!needsAuth && items.length > 0 && (
        <div className="mt-6 max-w-xl">
          <ListingFiltersPanel
            compact
            filters={filters}
            onChange={setFilters}
            sort={sort}
            onSortChange={setSort}
            matchedCount={filtered.length}
            totalCount={items.length}
            onReset={() => {
              setFilters(defaultListingFilters());
              setSort("score_desc");
            }}
          />
        </div>
      )}

      {!needsAuth && items.length === 0 && (
        <AppEmptyState
          title="Aún no has guardado oportunidades"
          description="Usa «Guardar» en una tarjeta o en la ficha y aparecerán aquí, con los mismos filtros que en Explorar."
          action={<AppPillButton href="/app/oportunidades">Ir a Oportunidades</AppPillButton>}
        />
      )}

      {!needsAuth && items.length > 0 && filtered.length === 0 && (
        <p className="mt-4 text-sm text-amber-900">Ningún guardado cumple los filtros actuales.</p>
      )}

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {filtered.map((l) => (
          <li
            key={l.id}
            className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                {portalBadge(l.source_portal ?? null).name}
                {l.city ? ` · ${l.city}` : ""}
              </p>
              <h2 className="line-clamp-2 font-medium capitalize text-neutral-950">
                {decodeListingTitle(l.title)}
              </h2>
              <p className="mt-2 text-lg font-bold tabular-nums text-neutral-950">
                {l.price.toLocaleString("es-ES")} €
              </p>
              <p className="mt-1 text-xs text-neutral-600">
                {l.bedrooms != null ? `${l.bedrooms} hab.` : "—"}
                {l.sqm != null ? ` · ${l.sqm} m²` : ""}
                {l.roi != null ? ` · ROI ${l.roi.toFixed(1)} %` : ""}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href={`/app/listings/${l.id}`}
                className="rounded-md bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white"
              >
                Ver ficha
              </Link>
              <a
                href={l.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-neutral-600 underline"
              >
                Anuncio original
              </a>
              <SaveListingButton listingId={l.id} compact className="ml-auto" />
            </div>
          </li>
        ))}
      </ul>
    </AppScrollPage>
  );
}
