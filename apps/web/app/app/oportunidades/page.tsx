"use client";

import {
  ListingDetailSidePanel,
  type SidePanelListing,
} from "@/components/listings/ListingDetailSidePanel";
import type { ListingSort } from "@/components/filters/ListingFiltersPanel";
import { OpportunityFeedSkeleton } from "@/components/oportunidades/OpportunityFeedSkeleton";
import { OpportunityFeedToolbar } from "@/components/oportunidades/OpportunityFeedToolbar";
import { OpportunityQuickChips } from "@/components/oportunidades/OpportunityQuickChips";
import { RadarOpportunityCard } from "@/components/oportunidades/RadarOpportunityCard";
import { RadarOpportunityListRow } from "@/components/oportunidades/RadarOpportunityListRow";
import { RoiScanMap } from "@/components/map/RoiScanMapLazy";
import type { GeocodeHit } from "@/lib/map/geocode-spain";
import { radiusFromBbox, ZONE_STOCK_TARGET } from "@/lib/map/cp-zone-stock";
import { cpFromGeocodeLabel } from "@/lib/map/geocode-spain";
import { applyListingViewPipeline } from "@/lib/listing/apply-opportunity-view";
import type { ListingSummary } from "@/lib/listing/summary-types";
import { defaultListingFilters } from "@/lib/scan/listing-filter-defaults";
import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";
import { filtersToUrlSearchParams, mergeUrlFiltersInto } from "@/lib/filters/url-sync";
import { decodeListingTitle } from "@/lib/decode-html";
import { useListingSummaries } from "@/lib/listing/use-listing-summaries";
import { AppEmptyState, AppPage, AppPageBody, AppPageHeader, AppPillButton } from "@/components/ui/AppPage";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

type OppRow = {
  id: string;
  title: string | null;
  city: string | null;
  postalCode: string | null;
  price: number;
  sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sourcePortal: string | null;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  scrapedAt: string | null;
  lng: number | null;
  lat: number | null;
  roi: number | null;
  rentEst: number | null;
  rentConfidence: string | null;
  summary: ListingSummary;
};

type ViewMode = "grid" | "list" | "map";

type ZoneContext = {
  lat: number;
  lng: number;
  cp: string | null;
  radiusM: number;
  label: string;
  bbox?: [number, number, number, number] | null;
};

function radiusFromGeocodeHit(hit: GeocodeHit): number {
  return radiusFromBbox(hit.bbox, 6500);
}

/** Feed ya viene pre-calificado por API; filtros UI parten abiertos. */
function defaultOportunidadFilters(): ScanRunFilters {
  return {
    ...defaultListingFilters(),
    minDiscountPct: 0,
    minOpportunityScore: 0,
    minRoiGross: 0,
    maxScrapedAgeDays: 14,
    onlyWithRoi: false,
    priceMax: 2_000_000,
  };
}

function OportunidadesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<OppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [totalQualified, setTotalQualified] = useState(0);
  const [feedSource, setFeedSource] = useState<"stored" | "computed" | "zone" | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [activeCp, setActiveCp] = useState<string | null>(null);
  const [zone, setZone] = useState<ZoneContext | null>(null);
  const [zoneImporting, setZoneImporting] = useState(false);
  const [totalInZone, setTotalInZone] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const zoneNextOffsetRef = useRef(0);
  const itemsLenRef = useRef(0);
  const [zoneHasMore, setZoneHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const ZONE_PAGE = 80;
  const [filters, setFilters] = useState<ScanRunFilters>(() => defaultOportunidadFilters());

  useEffect(() => {
    itemsLenRef.current = items.length;
  }, [items.length]);
  const [sort, setSort] = useState<ListingSort>("score_desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [summaryMode, setSummaryMode] = useState<"whole" | "rooms">("whole");
  const filtersUrlReady = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilters(mergeUrlFiltersInto(defaultOportunidadFilters(), params));
    const sortParam = params.get("sort");
    if (
      sortParam === "price_asc" ||
      sortParam === "price_desc" ||
      sortParam === "sqm_desc" ||
      sortParam === "roi_desc" ||
      sortParam === "score_desc" ||
      sortParam === "discount_desc"
    ) {
      setSort(sortParam);
    }
    const vm = params.get("view");
    if (vm === "grid" || vm === "list" || vm === "map") setViewMode(vm);
    const cp = params.get("cp");
    if (cp?.length === 5) {
      setActiveCp(cp);
      setLocationQuery(cp);
      void fetch(`/api/geocode?q=${encodeURIComponent(cp)}`)
        .then((r) => r.json())
        .then((data: { results?: GeocodeHit[] }) => {
          const hit = data.results?.[0];
          if (!hit) return;
          setLocationQuery(hit.label);
          setZone({
            lat: hit.lat,
            lng: hit.lng,
            cp,
            radiusM: radiusFromGeocodeHit(hit),
            label: hit.label,
            bbox: hit.bbox,
          });
        })
        .catch(() => undefined);
    }
    const listing = params.get("listing");
    if (listing) setSelected(listing);
    filtersUrlReady.current = true;
  }, []);

  useEffect(() => {
    if (!filtersUrlReady.current) return;
    const fp = filtersToUrlSearchParams(filters);
    fp.set("sort", sort);
    if (viewMode !== "grid") fp.set("view", viewMode);
    if (activeCp) fp.set("cp", activeCp);
    const listing = searchParams.get("listing");
    if (listing) fp.set("listing", listing);
    router.replace(`/app/oportunidades?${fp.toString()}`, { scroll: false });
  }, [filters, sort, viewMode, activeCp, router, searchParams]);

  const loadFeed = useCallback(async (cp?: string | null) => {
    setLoading(true);
    setLoadError(null);
    setZoneImporting(false);
    setTotalInZone(null);
    try {
      const q = cp ? `?cp=${cp}&limit=200` : "?limit=200";
      const res = await fetch(`/api/opportunities${q}`);
      const body = (await res.json()) as {
        items?: OppRow[];
        totalQualified?: number;
        source?: "stored" | "computed";
        error?: string;
      };
      if (!res.ok) {
        setLoadError(body.error ?? "No se pudo cargar oportunidades");
        setItems([]);
        return;
      }
      setItems(body.items ?? []);
      setTotalQualified(body.totalQualified ?? 0);
      setFeedSource(body.source ?? null);
    } catch {
      setLoadError("Error de red");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadZoneFeed = useCallback(
    async (
      z: ZoneContext,
      opts?: { live?: boolean; waitScrape?: boolean; silent?: boolean; append?: boolean }
    ) => {
      const append = opts?.append === true;
      if (append) setLoadingMore(true);
      else if (!opts?.silent) {
        setLoading(true);
        setLoadError(null);
        zoneNextOffsetRef.current = 0;
        setZoneHasMore(false);
      }
      const maxAgeDays = filters.maxScrapedAgeDays ?? 14;
      const offset = append ? zoneNextOffsetRef.current : 0;
      const limit = opts?.silent
        ? Math.min(400, Math.max(ZONE_PAGE, itemsLenRef.current || ZONE_PAGE))
        : ZONE_PAGE;
      try {
        const res = await fetch("/api/opportunities/zone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: z.lat,
            lng: z.lng,
            cp: z.cp ?? undefined,
            radiusM: z.radiusM,
            limit,
            offset,
            maxAgeDays,
            live: opts?.live !== false,
            waitScrape: opts?.waitScrape === true,
            chollosOnly: false,
            label: z.label,
            cpBbox: z.bbox ?? null,
          }),
        });
        const body = (await res.json()) as {
          items?: OppRow[];
          totalQualified?: number;
          opportunitiesInZone?: number;
          totalInZone?: number;
          refreshStarted?: boolean;
          stockSatisfied?: boolean;
          hasMore?: boolean;
          nextOffset?: number;
          radiusM?: number;
          cp?: string | null;
          staleRefresh?: { ageHours: number | null; refreshed: boolean } | null;
          error?: string;
        };
        if (!res.ok) {
          setLoadError(body.error ?? "No se pudo cargar la zona");
          if (!opts?.silent && !append) setItems([]);
          return;
        }
        if (append) {
          setItems((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            const next = [...prev];
            for (const it of body.items ?? []) {
              if (!seen.has(it.id)) next.push(it);
            }
            return next;
          });
        } else {
          setItems(body.items ?? []);
        }
        zoneNextOffsetRef.current =
          body.nextOffset ?? offset + (body.items?.length ?? 0);
        setZoneHasMore(body.hasMore === true);
        setTotalQualified(body.opportunitiesInZone ?? body.totalQualified ?? 0);
        setTotalInZone(body.totalInZone ?? null);
        /** La API puede ajustar el radio (exactitud del CP): reflejarlo en la zona activa. */
        if (body.radiusM && body.radiusM !== z.radiusM) {
          setZone((prev) => (prev ? { ...prev, radiusM: body.radiusM! } : prev));
        }
        setFeedSource("zone");
        /** Zona fría: la API refrescó antes de responder. */
        if (body.staleRefresh?.refreshed) {
          setZoneImporting(false);
        }
        const inZone = body.totalInZone ?? 0;
        const satisfied = body.stockSatisfied === true || inZone >= ZONE_STOCK_TARGET;
        setZoneImporting(Boolean(body.refreshStarted) || !satisfied);
      } catch {
        if (!opts?.silent && !append) {
          setLoadError("Error de red al cargar la zona");
          setItems([]);
        }
      } finally {
        if (append) setLoadingMore(false);
        else if (!opts?.silent) setLoading(false);
      }
    },
    [filters.maxScrapedAgeDays]
  );

  useEffect(() => {
    if (zone) void loadZoneFeed(zone, { live: true, waitScrape: false });
    else if (activeCp) void loadFeed(activeCp);
    else {
      setLoading(false);
      setItems([]);
      setFeedSource(null);
      setTotalQualified(0);
    }
  }, [zone, activeCp, loadFeed, loadZoneFeed, filters.maxScrapedAgeDays]);

  useEffect(() => {
    if (zone || !activeCp) return;
    const tick = window.setInterval(() => {
      void loadFeed(activeCp);
    }, 90_000);
    return () => window.clearInterval(tick);
  }, [zone, activeCp, loadFeed]);

  useEffect(() => {
    if (!zone || !zoneImporting) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    let ticks = 0;
    pollRef.current = setInterval(() => {
      ticks++;
      if (ticks > 50) {
        setZoneImporting(false);
        return;
      }
      const relive = ticks % 6 === 0;
      void loadZoneFeed(zone, { live: relive, silent: true });
    }, 8000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [zone, zoneImporting, loadZoneFeed]);

  const feedSummaries = useMemo(() => {
    const m: Record<string, ListingSummary> = {};
    for (const it of items) m[it.id] = it.summary;
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    const piped = applyListingViewPipeline(
      items.map((it) => ({
        id: it.id,
        price: it.price,
        sqm: it.sqm,
        bedrooms: it.bedrooms,
        bathrooms: it.bathrooms,
        source_portal: it.sourcePortal,
        title: it.title,
        sourceUrl: it.sourceUrl ?? undefined,
        scrapedAt: it.scrapedAt,
        roi: it.roi,
        rentConfidence: it.rentConfidence,
      })),
      filters,
      sort,
      feedSummaries
    );
    const order = new Map(piped.map((p, i) => [p.id, i]));
    return items
      .filter((it) => order.has(it.id))
      .sort((a, b) => (order.get(a.id)! ?? 0) - (order.get(b.id)! ?? 0));
  }, [items, filters, sort, feedSummaries]);

  const summaryIds = useMemo(() => filtered.map((r) => r.id).slice(0, 60), [filtered]);

  const {
    summaries: fetchedSummaries,
    loading: summariesLoading,
    detailLoading,
  } = useListingSummaries(summaryIds, { mode: summaryMode, detailId: selected });

  const summaries = useMemo(
    () => ({ ...feedSummaries, ...fetchedSummaries }),
    [feedSummaries, fetchedSummaries]
  );

  useEffect(() => {
    if (selected && !filtered.some((r) => r.id === selected)) setSelected(null);
  }, [filtered, selected]);

  const onLocationPick = useCallback((hit: GeocodeHit) => {
    setLocationQuery(hit.label);
    const cp = cpFromGeocodeLabel(hit.label);
    setActiveCp(cp);
    setZone({
      lat: hit.lat,
      lng: hit.lng,
      cp,
      radiusM: radiusFromGeocodeHit(hit),
      label: hit.label,
      bbox: hit.bbox,
    });
  }, []);

  const returnTo = useMemo(() => {
    const fp = filtersToUrlSearchParams(filters);
    fp.set("sort", sort);
    if (activeCp) fp.set("cp", activeCp);
    if (selected) fp.set("listing", selected);
    return `/app/oportunidades?${fp.toString()}`;
  }, [filters, sort, activeCp, selected]);

  const selectedListing = useMemo((): SidePanelListing | null => {
    if (!selected) return null;
    const it = items.find((x) => x.id === selected);
    if (!it) return null;
    return {
      id: it.id,
      title: it.title,
      price: it.price,
      city: it.city,
      sourcePortal: it.sourcePortal,
      thumbnailUrl: it.thumbnailUrl,
      bedrooms: it.bedrooms,
      bathrooms: it.bathrooms,
      sqm: it.sqm,
      roi: it.roi,
      rentEst: it.rentEst,
      sourceUrl: it.sourceUrl,
    };
  }, [selected, items]);

  const roiPins = useMemo(
    () =>
      filtered
        .filter((l) => l.lng != null && l.lat != null)
        .map((l) => ({
          id: l.id,
          lng: l.lng as number,
          lat: l.lat as number,
          roi: l.roi,
          price: l.price,
          rentEst: l.rentEst,
          rentConfidence: l.rentConfidence,
        })),
    [filtered]
  );

  const cardProps = (row: OppRow) => ({
    listingId: row.id,
    title: decodeListingTitle(row.title ?? "Inmueble"),
    city: row.city,
    postalCode: row.postalCode,
    price: row.price,
    sourcePortal: row.sourcePortal,
    thumbnailUrl: row.thumbnailUrl,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    sqm: row.sqm,
    roi: row.roi,
    rentEst: row.rentEst,
    sourceUrl: row.sourceUrl,
    scrapedAt: row.scrapedAt,
    summary: summaries[row.id] ?? row.summary,
    selected: selected === row.id,
    onSelect: () => setSelected(row.id),
    returnTo,
  });

  return (
    <AppPage>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <AppPageHeader
        title="Oportunidades"
        description="Busca un código postal o barrio en España; importamos anuncios en vivo para esa zona."
        meta={
          !loading ? (
            <>
              <span className="font-semibold tabular-nums text-neutral-900">
                {totalQualified.toLocaleString("es-ES")}
              </span>{" "}
              en catálogo
              {feedSource === "zone" ? " · zona en vivo" : feedSource ? " · actualizado" : ""}
            </>
          ) : null
        }
      />

      <OpportunityFeedToolbar
        filters={filters}
        onChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        locationQuery={locationQuery}
        onLocationQueryChange={setLocationQuery}
        onLocationPick={onLocationPick}
        activeCp={activeCp}
        onClearCp={() => {
          setActiveCp(null);
          setZone(null);
          setLocationQuery("");
          setZoneImporting(false);
          setTotalInZone(null);
        }}
        matchedCount={filtered.length}
        catalogTotal={zone ? (totalInZone ?? items.length) : items.length}
        zoneImporting={zoneImporting}
        onRefreshZone={
          zone
            ? () => void loadZoneFeed(zone, { live: true, waitScrape: true })
            : undefined
        }
        loading={loading}
        advancedOpen={advancedOpen}
        onAdvancedOpenChange={setAdvancedOpen}
        zoneLabel={zone?.label ?? null}
        zoneCpNote={
          zone && zone.cp
            ? `CP ${zone.cp} · ${Math.round(zone.radiusM / 1000)} km a la redonda`
            : zone
              ? `Área · ${Math.round(zone.radiusM / 1000)} km a la redonda`
              : null
        }
        onReset={() => {
          setFilters(defaultOportunidadFilters());
          setSort("score_desc");
          setAdvancedOpen(false);
        }}
      />
      <OpportunityQuickChips filters={filters} onChange={setFilters} />

      <AppPageBody wide>
          {loadError && (
            <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {loadError}
            </p>
          )}

          {loading && <OpportunityFeedSkeleton count={20} />}

          {!loading && filtered.length === 0 && !loadError && !zone && !activeCp && (
            <AppEmptyState
              title="Empieza por una zona"
              description="Escribe un CP de 5 dígitos (ej. 04638, 33201). El sistema importa portales para esa zona y te muestra solo inventario reciente."
            />
          )}

          {!loading && filtered.length === 0 && !loadError && (zone || activeCp) && (
            <AppEmptyState
              title="Sin resultados con estos criterios"
              description="Relaja descuento, score o antigüedad en los filtros, o amplía la zona de búsqueda."
              action={
                <AppPillButton
                  onClick={() => {
                    setFilters(defaultOportunidadFilters());
                    setSort("score_desc");
                    setAdvancedOpen(false);
                  }}
                >
                  Restablecer filtros
                </AppPillButton>
              }
            />
          )}

          {!loading && viewMode === "map" && filtered.length > 0 && (
            <div className="relative mb-6 h-[min(72vh,680px)] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <RoiScanMap
                pins={roiPins}
                selectedId={selected}
                onSelectPin={setSelected}
                maxPins={200}
                className="absolute inset-0 h-full w-full"
              />
            </div>
          )}

          {!loading && viewMode !== "map" && filtered.length > 0 && (
            <div
              className={
                viewMode === "grid"
                  ? selected
                    ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3"
                    : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                  : "mx-auto flex max-w-4xl flex-col gap-3"
              }
            >
              {filtered.map((row) =>
                viewMode === "grid" ? (
                  <RadarOpportunityCard key={row.id} {...cardProps(row)} />
                ) : (
                  <RadarOpportunityListRow key={row.id} {...cardProps(row)} />
                )
              )}
            </div>
          )}

          {!loading && zone && zoneHasMore && viewMode !== "map" && (
            <div className="mt-8 flex justify-center">
              <AppPillButton
                disabled={loadingMore}
                onClick={() => void loadZoneFeed(zone, { live: false, append: true })}
              >
                {loadingMore ? "Cargando…" : "Cargar más en esta zona"}
              </AppPillButton>
            </div>
          )}
      </AppPageBody>
      </div>

      {selected && selectedListing && (
        <button
          type="button"
          aria-label="Cerrar panel"
          className="fixed inset-0 z-30 bg-black/25 xl:hidden"
          onClick={() => setSelected(null)}
        />
      )}
      <ListingDetailSidePanel
        listing={selectedListing}
        summary={selected ? summaries[selected] ?? null : null}
        summaryLoading={Boolean(selected && !summaries[selected] && summariesLoading)}
        detailLoading={detailLoading}
        summaryMode={summaryMode}
        onSummaryModeChange={setSummaryMode}
        onClose={() => setSelected(null)}
        showEmptyState={false}
      />
    </AppPage>
  );
}

export default function OportunidadesPage() {
  return (
    <Suspense
      fallback={
        <AppPage>
          <div className="border-b border-neutral-200 bg-white px-8 py-6">
            <div className="h-8 w-48 animate-pulse rounded bg-neutral-100" />
          </div>
          <div className="flex-1 p-8">
            <OpportunityFeedSkeleton />
          </div>
        </AppPage>
      }
    >
      <OportunidadesPageContent />
    </Suspense>
  );
}
