"use client";

import {
  ListingDetailSidePanel,
  type SidePanelListing,
} from "@/components/listings/ListingDetailSidePanel";
import { RoiScanMap } from "@/components/map/RoiScanMapLazy";
import { ResultListingCard } from "@/components/scan/ResultListingCard";
import { pinFallbackListing } from "@/lib/listing/resolve-side-panel-listing";
import { ScanProgressOverlay } from "@/components/scan/ScanProgressOverlay";
import { AppPanelHeader } from "@/components/app/AppPanelHeader";
import {
  ListingFiltersPanel,
  type ListingSort,
} from "@/components/filters/ListingFiltersPanel";
import { ScanResultsToolbar } from "@/components/scan/ScanResultsToolbar";
import { normalizeScanFilters } from "@/lib/scan/apply-scan-filters";
import { defaultListingFilters } from "@/lib/scan/listing-filter-defaults";
import { applyListingViewPipeline } from "@/lib/listing/apply-opportunity-view";
import type { ScanPolygon } from "@/lib/scan/types";
import { boundsFromPins, polygonBounds } from "@/lib/map/polygon-bounds";
import { parseScanPolygon } from "@/lib/map/parse-scan-polygon";
import { SPAIN_VIEW } from "@/lib/map/spain-bounds";
import { scanOperationUsesRoi } from "@/lib/investment/operations";
import { SCAN_ZONE_SOFT_WARN_BELOW, SCAN_ZONE_TARGET_IN_POLYGON } from "@/lib/scan/zone-target";
import { safeScanMessage } from "@/lib/scan/user-facing-messages";
import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";
import { filtersToUrlSearchParams, mergeUrlFiltersInto } from "@/lib/filters/url-sync";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useListingSummaries } from "@/lib/listing/use-listing-summaries";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

type ResultRow = {
  rank: number;
  roi_gross: number;
  listing: {
    id: string;
    title: string | null;
    price: number;
    source_url: string;
    city?: string | null;
    postal_code?: string | null;
    source_portal?: string | null;
    thumbnail_url?: string | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    sqm?: number | null;
    listing_investment?: { rent_est: number | null; rent_confidence: string | null };
  };
};

type Pin = { id: string; lng: number; lat: number; roi: number | null; price: number };

function ScanResultsPageContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [repeating, setRepeating] = useState(false);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [status, setStatus] = useState("pending");
  const [polygon, setPolygon] = useState<ScanPolygon | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mapCount, setMapCount] = useState(0);
  const [zoneTotal, setZoneTotal] = useState(0);
  const [zoneMatchingFilters, setZoneMatchingFilters] = useState(0);
  const [sort, setSort] = useState<ListingSort>("score_desc");
  const [viewFilters, setViewFilters] = useState<ScanRunFilters>(() => defaultListingFilters());
  const [viewFiltersReady, setViewFiltersReady] = useState(false);
  const [viewFiltersOpen, setViewFiltersOpen] = useState(true);
  const viewFiltersUrlReady = useRef(false);
  const hadUrlRefine = useRef(false);
  const runKickRef = useRef(false);
  const [mapFallback, setMapFallback] = useState(false);
  const [flyTo, setFlyTo] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scanErrorMessage, setScanErrorMessage] = useState<string | null>(null);
  const [scanFilters, setScanFilters] = useState<ScanRunFilters | null>(null);
  const [scanOperation, setScanOperation] = useState<string>("buy_to_rent");
  const usesRoi = scanOperationUsesRoi(scanOperation);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    hadUrlRefine.current = ["pmin", "pmax", "roi", "portals", "sqmMin"].some((k) => params.has(k));
    setViewFilters((f) => mergeUrlFiltersInto(f, params));
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
    viewFiltersUrlReady.current = true;
  }, [id]);

  useEffect(() => {
    if (!viewFiltersUrlReady.current) return;
    const fp = filtersToUrlSearchParams(viewFilters);
    fp.set("sort", sort);
    const listing = searchParams.get("listing");
    if (listing) fp.set("listing", listing);
    const qs = fp.toString();
    router.replace(qs ? `/app/scan/${id}?${qs}` : `/app/scan/${id}`, { scroll: false });
  }, [viewFilters, sort, id, router, searchParams]);

  useEffect(() => {
    runKickRef.current = false;
  }, [id]);

  useEffect(() => {
    if (!id || runKickRef.current) return;
    runKickRef.current = true;
    void (async () => {
      const s = await fetch(`/api/scans/${id}`);
      if (!s.ok) return;
      const scan = (await s.json()) as { status?: string };
      if (scan.status === "pending") {
        await fetch(`/api/scans/${id}/run`, { method: "POST" });
      }
    })();
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const s = await fetch(`/api/scans/${id}`);
      if (!s.ok) {
        if (!cancelled) {
          setLoadError(s.status === 403 ? "No tienes acceso a este scan." : "Scan no encontrado.");
          setStatus("failed");
        }
        return;
      }
      const scan = (await s.json()) as {
        status: string;
        polygon?: unknown;
        operation?: string;
        error_message?: string | null;
      };
      if (!cancelled) {
        setLoadError(null);
        setStatus(scan.status ?? "failed");
        setScanErrorMessage(safeScanMessage(scan.error_message));
        setScanOperation(scan.operation ?? "buy_to_rent");
        if (scan.operation === "buy") setSort("price_asc");
        const parsedPoly = parseScanPolygon(scan.polygon);
        if (parsedPoly) setPolygon(parsedPoly);
      }
      const r = await fetch(`/api/scans/${id}/results`);
      if (!r.ok) {
        if (!cancelled && s.ok) {
          const stillRunning = scan.status === "running" || scan.status === "pending";
          if (stillRunning) {
            setLoadError(null);
          } else {
            setLoadError("No se pudieron cargar los resultados.");
          }
        }
        return;
      }
      const data = (await r.json()) as {
        results: ResultRow[];
        pins?: Pin[];
        mapCount?: number;
        zoneTotal?: number;
        zoneMatchingFilters?: number;
        usedMapFallback?: boolean;
        polygon?: ScanPolygon;
        filters?: ScanRunFilters;
      };
      if (!cancelled) {
        setRows(data.results ?? []);
        setPins(data.pins ?? []);
        setMapCount(data.mapCount ?? data.pins?.length ?? 0);
        setZoneTotal(data.zoneTotal ?? 0);
        setZoneMatchingFilters(data.zoneMatchingFilters ?? 0);
        setMapFallback(Boolean(data.usedMapFallback));
        if (data.filters) {
          setScanFilters(data.filters);
          if (!viewFiltersReady && !hadUrlRefine.current) {
            setViewFilters({
              ...defaultListingFilters(),
              ...normalizeScanFilters(data.filters as Record<string, unknown>),
            });
          }
          if (!viewFiltersReady) setViewFiltersReady(true);
        }
        const polyFromResults = parseScanPolygon(data.polygon);
        if (polyFromResults) setPolygon(polyFromResults);
      }
    }
    load();
    const terminal = status === "completed" || status === "failed";
    const t = setInterval(load, terminal ? 8000 : 2000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id, status]);

  const priceBounds = useMemo(() => {
    if (rows.length === 0) return { min: 0, max: 500_000 };
    let min = Infinity;
    let max = 0;
    for (const r of rows) {
      const p = r.listing.price;
      if (p < min) min = p;
      if (p > max) max = p;
    }
    return { min: Number.isFinite(min) ? min : 0, max: max || 500_000 };
  }, [rows]);

  const [summaryMode, setSummaryMode] = useState<"whole" | "rooms">("whole");
  useEffect(() => {
    setSummaryMode(scanOperation === "buy_to_rent_rooms" ? "rooms" : "whole");
  }, [scanOperation, id]);

  const listingIds = useMemo(() => {
    const ids = rows.slice(0, 55).map((r) => r.listing.id);
    if (selected && !ids.includes(selected)) ids.push(selected);
    return ids;
  }, [rows, selected]);
  const { summaries, loading: summariesLoading } = useListingSummaries(listingIds, {
    detailId: selected,
    mode: summaryMode,
  });

  const sortedRows = useMemo(() => {
    const piped = applyListingViewPipeline(
      rows.map((r) => ({
        id: r.listing.id,
        price: r.listing.price,
        bedrooms: r.listing.bedrooms,
        bathrooms: r.listing.bathrooms,
        sqm: r.listing.sqm,
        source_portal: r.listing.source_portal,
        title: r.listing.title,
        sourceUrl: r.listing.source_url,
        roi: r.roi_gross,
        rentConfidence: r.listing.listing_investment?.rent_confidence,
      })),
      viewFilters,
      sort,
      summaries
    );
    const order = new Map(piped.map((p, i) => [p.id, i]));
    return [...rows]
      .filter((r) => order.has(r.listing.id))
      .sort((a, b) => (order.get(a.listing.id)! ?? 0) - (order.get(b.listing.id)! ?? 0));
  }, [rows, viewFilters, sort, summaries]);

  const visiblePinIds = useMemo(() => new Set(sortedRows.map((r) => r.listing.id)), [sortedRows]);

  const filteredPins = useMemo(
    () => pins.filter((p) => visiblePinIds.has(p.id)),
    [pins, visiblePinIds]
  );

  const didInitialSelect = useRef(false);
  const rentById = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const row of rows) {
      m.set(row.listing.id, row.listing.listing_investment?.rent_est ?? null);
    }
    return m;
  }, [rows]);

  const roiPins = useMemo(
    () =>
      filteredPins.map((p) => ({
        ...p,
        rentEst: rentById.get(p.id) ?? null,
      })),
    [filteredPins, rentById]
  );

  const listingReturnTo = useMemo(() => {
    const base = `/app/scan/${id}`;
    const sel = selected ?? searchParams.get("listing");
    return sel ? `${base}?listing=${sel}` : base;
  }, [id, selected, searchParams]);

  const selectListing = (listingId: string, panMap = false) => {
    setSelected(listingId);
    router.replace(`/app/scan/${id}?listing=${listingId}`, { scroll: false });
    if (!panMap) return;
    const pin = roiPins.find((p) => p.id === listingId);
    if (pin) setFlyTo({ center: [pin.lng, pin.lat], zoom: 15 });
  };

  useEffect(() => {
    const fromUrl = searchParams.get("listing");
    if (fromUrl) {
      setSelected(fromUrl);
      didInitialSelect.current = true;
      return;
    }
    if (didInitialSelect.current || sortedRows.length === 0) return;
    didInitialSelect.current = true;
    const first = sortedRows[0]!.listing.id;
    setSelected(first);
    router.replace(`/app/scan/${id}?listing=${first}`, { scroll: false });
  }, [sortedRows, searchParams, id, router]);

  const mapFitBounds = useMemo(() => {
    if (polygon) return polygonBounds(polygon);
    return boundsFromPins(filteredPins.length ? filteredPins : pins);
  }, [polygon, pins, filteredPins]);

  const selectedListing = useMemo((): SidePanelListing | null => {
    if (!selected) return null;
    const row = sortedRows.find((r) => r.listing.id === selected);
    if (row) {
      const l = row.listing;
      return {
        id: l.id,
        title: l.title,
        price: l.price,
        city: l.city,
        sourcePortal: l.source_portal,
        thumbnailUrl: l.thumbnail_url,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        sqm: l.sqm,
        roi: row.roi_gross,
        rentEst: l.listing_investment?.rent_est ?? null,
        sourceUrl: l.source_url,
        rank: row.rank,
      };
    }
    const pin = roiPins.find((p) => p.id === selected);
    if (pin) return pinFallbackListing(selected, pin);
    return null;
  }, [selected, sortedRows, roiPins]);

  const running = status !== "completed" && status !== "failed";
  const progressStep =
    status === "pending" ? 0 : status === "running" ? 1 : status === "ranking" ? 2 : 2;
  const [runStale, setRunStale] = useState(false);
  useEffect(() => {
    if (!running) {
      setRunStale(false);
      return;
    }
    const t = window.setTimeout(() => setRunStale(true), 90_000);
    return () => window.clearTimeout(t);
  }, [running, id]);

  function exportJson() {
    const blob = new Blob([JSON.stringify({ scanId: id, results: sortedRows, pins }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `scan-${id.slice(0, 8)}.json`;
    a.click();
  }

  function csvCell(v: string | number | null | undefined) {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function exportCsv() {
    const header = "rank,roi_gross,price,bedrooms,sqm,city,title,url,id";
    const lines = sortedRows.map((r) => {
      const l = r.listing;
      return [
        r.rank,
        r.roi_gross.toFixed(2),
        l.price,
        l.bedrooms ?? "",
        l.sqm ?? "",
        l.city ?? "",
        l.title ?? "",
        l.source_url,
        l.id,
      ]
        .map(csvCell)
        .join(",");
    });
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `scan-${id.slice(0, 8)}.csv`;
    a.click();
  }

  async function repeatScan() {
    setRepeating(true);
    try {
      const res = await fetch(`/api/scans/${id}/repeat`, { method: "POST" });
      const data = (await res.json()) as { scanId?: string; error?: string };
      if ((!res.ok && res.status !== 202) || !data.scanId) {
        alert(data.error ?? "No se pudo repetir el scan");
        return;
      }
      router.push(`/app/scan/${data.scanId}`);
    } finally {
      setRepeating(false);
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ScanResultsToolbar
        scanId={id}
        sort={sort}
        onSortChange={setSort}
        onExportCsv={exportCsv}
        onExportJson={exportJson}
        onRepeat={() => void repeatScan()}
        repeating={repeating}
        showRoiSort={usesRoi}
        totalCount={rows.length}
        filteredCount={sortedRows.length}
        priceMin={viewFilters.priceMin ?? 0}
        priceMax={viewFilters.priceMax ?? 2_000_000}
        priceCeiling={Math.max(priceBounds.max, scanFilters?.priceMax ?? priceBounds.max)}
        onPriceMinChange={(v) => setViewFilters((f) => ({ ...f, priceMin: Math.max(0, v) }))}
        onPriceMaxChange={(v) =>
          setViewFilters((f) => ({
            ...f,
            priceMax: Math.max(f.priceMin ?? 0, v),
          }))
        }
      />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-r border-neutral-200 bg-[#f3f2ef] lg:w-[min(380px,34vw)]">
          {loadError && (
            <p className="mx-3 mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
              {loadError}
            </p>
          )}
          {status === "failed" && !loadError && (
            <p className="mx-3 mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
              {scanErrorMessage
                ? scanErrorMessage
                : "El scan falló. Repite con otra zona o filtros más amplios."}
            </p>
          )}
          {status === "completed" && scanErrorMessage && (
            <p className="mx-3 mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
              {scanErrorMessage}
            </p>
          )}
          <AppPanelHeader
            title="Resultados del scan"
            subtitle={
              usesRoi
                ? `${sortedRows.length} mostrados · ${rows.length} en ranking · ${zoneMatchingFilters} en zona (inventario)`
                : `${sortedRows.length} mostrados · ${rows.length} en scan · ${zoneMatchingFilters} en zona`
            }
          />
          {scanFilters && (
            <p className="mx-3 -mt-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px] text-neutral-700">
              Scan (wizard): {(scanFilters.priceMin ?? 0).toLocaleString("es-ES")}–
              {(scanFilters.priceMax ?? 0).toLocaleString("es-ES")} €
              {zoneTotal > zoneMatchingFilters ? (
                <> · {zoneTotal} en polígono antes de filtros del ranking</>
              ) : null}
            </p>
          )}
          <div className="mx-3">
            <button
              type="button"
              onClick={() => setViewFiltersOpen((o) => !o)}
              className="mb-2 flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium"
            >
              Refinar resultados
              <span className="text-neutral-400">{viewFiltersOpen ? "▾" : "▸"}</span>
            </button>
            {viewFiltersOpen && (
              <ListingFiltersPanel
                compact
                showRoi={usesRoi}
                filters={viewFilters}
                onChange={setViewFilters}
                sort={sort}
                onSortChange={setSort}
                matchedCount={sortedRows.length}
                totalCount={rows.length}
                onReset={() => {
                  if (scanFilters) {
                    setViewFilters({
                      ...defaultListingFilters(),
                      ...normalizeScanFilters(scanFilters as Record<string, unknown>),
                    });
                  } else setViewFilters(defaultListingFilters());
                  setSort(usesRoi ? "roi_desc" : "price_asc");
                }}
              />
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
            {rows.length > 0 && sortedRows.length === 0 && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                Ningún resultado con estos filtros de vista. Amplía precio, ROI o portales, o restablece.
              </p>
            )}
            {mapFallback && sortedRows.length > 0 && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                Ningún piso encajó en el ranking del scan con tus filtros actuales. Mostramos anuncios en
                la zona que sí cumplen precio y dormitorios (puede haber más en portales aún no scrapeados).
              </p>
            )}
            {sortedRows.length === 0 && status === "completed" && (
              <p className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
                Sin resultados en inventario para esta zona y rango de precio. Prueba «Modo rango de precio de
                compra» (p. ej. 120 000–130 000 €), amplía el radio o repite el scan.
              </p>
            )}
            {zoneTotal > 0 && zoneTotal < SCAN_ZONE_SOFT_WARN_BELOW && status === "completed" && (
              <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
                {zoneTotal} ventas en el mapa (objetivo ~{SCAN_ZONE_TARGET_IN_POLYGON} por búsqueda). Cada scan
                importa Fotocasa y pisos.com del barrio; repite el scan o sube el radio a 2–3 km si acabas de
                empezar.
              </p>
            )}
            {sortedRows.map((row) => (
              <ResultListingCard
                key={row.listing.id}
                title={row.listing.title ?? "Inmueble"}
                price={row.listing.price}
                roi={usesRoi ? row.roi_gross : null}
                rentEst={usesRoi ? row.listing.listing_investment?.rent_est : null}
                sourceUrl={row.listing.source_url}
                listingId={row.listing.id}
                sourcePortal={row.listing.source_portal}
                thumbnailUrl={row.listing.thumbnail_url}
                bedrooms={row.listing.bedrooms}
                bathrooms={row.listing.bathrooms}
                sqm={row.listing.sqm}
                city={row.listing.city}
                postalCode={row.listing.postal_code}
                selected={selected === row.listing.id}
                onHover={() => selectListing(row.listing.id, false)}
                onSelect={() => selectListing(row.listing.id, true)}
                compact
                summary={summaries[row.listing.id] ?? null}
                summaryLoading={summariesLoading}
                returnTo={listingReturnTo}
              />
            ))}
          </div>
        </aside>
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-neutral-100">
          {running && rows.length === 0 && (
            <>
              <ScanProgressOverlay activeStep={progressStep} />
              {runStale && (
                <div className="absolute bottom-6 left-1/2 z-40 w-[min(92%,360px)] -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950 shadow">
                  <p>Tarda más de lo habitual. Puedes esperar o relanzar la importación.</p>
                  <button
                    type="button"
                    className="mt-2 rounded-lg bg-neutral-950 px-4 py-2 text-xs font-semibold text-white"
                    onClick={() =>
                      void fetch(`/api/scans/${id}/run?force=1`, { method: "POST" })
                    }
                  >
                    Reintentar scan
                  </button>
                </div>
              )}
            </>
          )}
          <RoiScanMap
            key={id}
            pins={roiPins}
            polygon={polygon}
            zoneVisual="radius"
            selectedId={selected}
            onSelectPin={(pid) => selectListing(pid, true)}
            initialView={SPAIN_VIEW}
            mapFitBounds={mapFitBounds}
            fitKey={`${id}-${pins.length}-${polygon ? "p" : "n"}`}
            flyTo={flyTo}
            maxPins={200}
            className="absolute inset-0 h-full w-full"
          />
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
          summary={selected ? (summaries[selected] ?? null) : null}
          summaryLoading={summariesLoading}
          onClose={() => setSelected(null)}
          preferRoomsTab={scanOperation === "buy_to_rent_rooms"}
          summaryMode={summaryMode}
          onSummaryModeChange={setSummaryMode}
        />
      </div>
    </div>
  );
}

export default function ScanResultsPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center p-8 text-sm text-neutral-600">Cargando scan…</div>}>
      <ScanResultsPageContent />
    </Suspense>
  );
}
