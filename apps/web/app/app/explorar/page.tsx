"use client";

import {
  ListingDetailSidePanel,
  type SidePanelListing,
} from "@/components/listings/ListingDetailSidePanel";
import { PremiumListingCard } from "@/components/listings/PremiumListingCard";
import { pinFallbackListing } from "@/lib/listing/resolve-side-panel-listing";
import { useListingSummaries } from "@/lib/listing/use-listing-summaries";
import { RoiScanMap } from "@/components/map/RoiScanMapLazy";
import type { MapFeatureCollection } from "@/lib/map/geojson-types";
import { EXPLORAR_MIN_ZOOM_FOR_BBOX, ZONE_STOCK_TARGET } from "@/lib/map/cp-zone-stock";
import { SPAIN_VIEW } from "@/lib/map/spain-bounds";
import { decodeListingTitle } from "@/lib/decode-html";
import { ListingFiltersPanel, type ListingSort } from "@/components/filters/ListingFiltersPanel";
import { SpainLocationSearch } from "@/components/location/SpainLocationSearch";
import { AppPanelHeader } from "@/components/app/AppPanelHeader";
import { cpFromGeocodeLabel, type GeocodeHit } from "@/lib/map/geocode-spain";
import { radiusFromBbox } from "@/lib/map/cp-zone-stock";
import { applyListingViewPipeline } from "@/lib/listing/apply-opportunity-view";
import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";
import { defaultListingFilters } from "@/lib/scan/listing-filter-defaults";
import { mapListingFiltersToSearchParams } from "@/lib/map/map-listing-filters";
import Link from "next/link";
import { portalBadge } from "@/lib/portals";
import {
  filtersToUrlSearchParams,
  mergeUrlFiltersInto,
  oportunidadesHrefFromFilters,
} from "@/lib/filters/url-sync";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

const FILTERS_STORAGE_KEY = "pi-explorar-filters-v1";

type ListingPin = {
  id: string;
  lng: number;
  lat: number;
  roi: number | null;
  price: number;
  source: string | null;
  title: string | null;
  sourceUrl: string | null;
  city?: string | null;
  thumbnailUrl?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqm?: number | null;
  rentEst?: number | null;
  rentConfidence?: string | null;
  geocodeQuality?: number | null;
  scrapedAt?: string | null;
  isOpportunity?: boolean;
  opportunityScore?: number | null;
};

type ExplorarViewMode = "list" | "grid" | "map";

function ExplorarPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [listings, setListings] = useState<ListingPin[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const lastBboxRef = useRef<[number, number, number, number] | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [summaryMode, setSummaryMode] = useState<"whole" | "rooms">("whole");
  const [showIneLayer, setShowIneLayer] = useState(false);
  const [censusOverlay, setCensusOverlay] = useState<MapFeatureCollection | null>(null);
  const lastZoomRef = useRef(12);
  const [cpQuery, setCpQuery] = useState("");
  const [cpLoading, setCpLoading] = useState(false);
  const [cpSummary, setCpSummary] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [filters, setFilters] = useState<ScanRunFilters>(() => defaultListingFilters());
  const [sort, setSort] = useState<ListingSort>("score_desc");
  const [viewMode, setViewMode] = useState<ExplorarViewMode>("list");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [censusStatus, setCensusStatus] = useState<
    "off" | "zoom" | "loading" | "ok" | "empty" | "error"
  >("off");
  const cpLoadSeq = useRef(0);
  const mapLoadSeq = useRef(0);
  const filtersUrlReady = useRef(false);
  const [activeCp, setActiveCp] = useState<string | null>(null);
  const activeCpRef = useRef<string | null>(null);

  useEffect(() => {
    let base = defaultListingFilters();
    try {
      const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY);
      if (raw) base = { ...base, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    const params = new URLSearchParams(window.location.search);
    setFilters(mergeUrlFiltersInto(base, params));
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
    if (vm === "list" || vm === "grid" || vm === "map") setViewMode(vm);
    filtersUrlReady.current = true;
  }, []);

  useEffect(() => {
    if (!filtersUrlReady.current) return;
    try {
      sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch {
      /* ignore */
    }
    const fp = filtersToUrlSearchParams(filters);
    fp.set("sort", sort);
    if (viewMode !== "list") fp.set("view", viewMode);
    const listing = searchParams.get("listing");
    if (listing) fp.set("listing", listing);
    if (activeCp) fp.set("cp", activeCp);
    const qs = fp.toString();
    router.replace(qs ? `/app/explorar?${qs}` : "/app/explorar", { scroll: false });
  }, [filters, sort, viewMode, activeCp, router, searchParams]);

  useEffect(() => {
    const lid = searchParams.get("listing");
    if (lid) setSelected(lid);
  }, [searchParams]);

  const explorarReturnTo = useMemo(
    () => (selected ? `/app/explorar?listing=${selected}` : "/app/explorar"),
    [selected]
  );

  const loadCensus = useCallback(
    async (bbox: [number, number, number, number], zoom: number) => {
      if (!showIneLayer) {
        setCensusOverlay(null);
        setCensusStatus("off");
        return;
      }
      if (zoom < 11) {
        setCensusOverlay(null);
        setCensusStatus("zoom");
        return;
      }
      setCensusStatus("loading");
      const [minLng, minLat, maxLng, maxLat] = bbox;
      const res = await fetch(
        `/api/map/census-sections?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}&zoom=${zoom}`
      );
      if (!res.ok) {
        setCensusOverlay(null);
        setCensusStatus("error");
        return;
      }
      const data = (await res.json()) as MapFeatureCollection & { error?: string };
      if (data.error) {
        setCensusOverlay(null);
        setCensusStatus("error");
        return;
      }
      const n = data.features?.length ?? 0;
      setCensusOverlay(n ? data : null);
      setCensusStatus(n ? "ok" : "empty");
    },
    [showIneLayer]
  );

  const loadByPostalCode = useCallback(async (cpOverride?: string) => {
    const cp = (cpOverride ?? cpQuery).replace(/\D/g, "").slice(0, 5);
    if (cp.length !== 5) return;
    const seq = ++cpLoadSeq.current;
    setActiveCp(cp);
    activeCpRef.current = cp;
    setCpLoading(true);
    setCpSummary(null);
    try {
      const applyPayload = (data: {
        features?: ListingPin[];
        total?: number;
        totalInZone?: number;
        byPortal?: Record<string, number>;
        center?: { lat: number; lng: number };
        stockSatisfied?: boolean;
      }) => {
        if (seq !== cpLoadSeq.current) return;
        const feats = data.features ?? [];
        setListings(feats);
        if (data.center) {
          setFlyTo({ center: [data.center.lng, data.center.lat], zoom: 14 });
        }
        const parts = data.byPortal
          ? Object.entries(data.byPortal)
              .sort((a, b) => b[1] - a[1])
              .map(([p, n]) => `${p} ${n}`)
              .join(" · ")
          : "";
        const n = data.totalInZone ?? data.total ?? feats.length;
        const stockNote =
          data.stockSatisfied === false
            ? ` · objetivo ${ZONE_STOCK_TARGET} (importando…)`
            : " · zona lista";
        setCpSummary(
          `${n} ventas CP ${cp}${stockNote}${parts ? ` · ${parts}` : ""}`
        );
      };

      setCpSummary("Importando portales en segundo plano…");
      const kick = await fetch(`/api/map/listings-by-cp?cp=${cp}&max=800&live=1&wait=0`);
      const kickData = (await kick.json()) as {
        features?: ListingPin[];
        total?: number;
        byPortal?: Record<string, number>;
        center?: { lat: number; lng: number };
        error?: string;
        refreshStarted?: boolean;
        totalInZone?: number;
        stockSatisfied?: boolean;
      };
      if (!kick.ok) {
        if (seq === cpLoadSeq.current) setCpSummary(kickData.error ?? "Error al cargar CP");
        return;
      }
      applyPayload(kickData);

      if (kickData.refreshStarted || kickData.stockSatisfied === false) {
        let lastTotal = kickData.totalInZone ?? kickData.total ?? 0;
        for (let i = 0; i < 28; i++) {
          if (seq !== cpLoadSeq.current) break;
          await new Promise((r) => setTimeout(r, 10_000));
          setCpSummary(`Importando portales… (${(i + 1) * 10}s) · ${lastTotal}/${ZONE_STOCK_TARGET}`);
          const poll = await fetch(`/api/map/listings-by-cp?cp=${cp}&max=800&live=0`);
          const pollData = (await poll.json()) as typeof kickData;
          if (!poll.ok) continue;
          applyPayload(pollData);
          const t = pollData.totalInZone ?? pollData.total ?? 0;
          if (t > lastTotal) lastTotal = t;
          if (pollData.stockSatisfied || t >= ZONE_STOCK_TARGET) break;
        }
      }
    } catch (e) {
      if (seq === cpLoadSeq.current) {
        const msg = e instanceof Error ? e.message : "Error";
        setCpSummary(msg);
      }
    } finally {
      if (seq === cpLoadSeq.current) setCpLoading(false);
    }
  }, [cpQuery]);

  useEffect(() => {
    const cp = searchParams.get("cp")?.replace(/\D/g, "").slice(0, 5);
    if (cp?.length === 5 && cp !== activeCpRef.current) {
      setCpQuery(cp);
      void loadByPostalCode(cp);
    }
  }, [searchParams, loadByPostalCode]);

  /**
   * Barrio o municipio: mismo feed de zona que Oportunidades, pero como pins del mapa.
   * Antes solo se volaba y no se cargaba inventario del área.
   */
  const loadByArea = useCallback(
    async (hit: GeocodeHit, cp: string | null) => {
      const seq = ++cpLoadSeq.current;
      activeCpRef.current = null;
      setActiveCp(null);
      setCpLoading(true);
      setCpSummary("Cargando zona…");
      const radiusM = radiusFromBbox(hit.bbox, 6500);
      try {
        const body = {
          lat: hit.lat,
          lng: hit.lng,
          cp: cp ?? undefined,
          cpBbox: hit.bbox,
          radiusM,
          limit: 400,
          live: true,
          chollosOnly: false,
          label: hit.label,
        };
        const r = await fetch("/api/opportunities/zone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await r.json()) as {
          items?: {
            id: string;
            lat: number | null;
            lng: number | null;
            price: number;
            roi: number | null;
            title: string | null;
          }[];
          totalInZone?: number;
          opportunitiesInZone?: number;
          radiusM?: number;
          error?: string;
        };
        if (seq !== cpLoadSeq.current) return;
        if (!r.ok) {
          setCpSummary(data.error ?? "No se pudo cargar la zona");
          return;
        }
        const features: ListingPin[] = (data.items ?? [])
          .filter((it) => it.lat != null && it.lng != null)
          .map((it) => ({
            id: it.id,
            lng: it.lng as number,
            lat: it.lat as number,
            price: it.price,
            roi: it.roi,
            source: "area",
            title: it.title ?? null,
            sourceUrl: null,
          }));
        setListings(features);
        const km = Math.round((data.radiusM ?? radiusM) / 1000);
        setCpSummary(
          `${data.totalInZone ?? features.length} anuncios · ${km} km a la redonda · ${
            data.opportunitiesInZone ?? 0
          } oportunidades`
        );
        setFlyTo({ center: [hit.lng, hit.lat], zoom: hit.bbox ? 13 : 14 });
      } catch {
        if (seq === cpLoadSeq.current) setCpSummary("Error de red al cargar la zona");
      } finally {
        if (seq === cpLoadSeq.current) setCpLoading(false);
      }
    },
    []
  );

  const onLocationPick = useCallback(
    (hit: GeocodeHit) => {
      const cp = cpFromGeocodeLabel(hit.label);
      setLocationQuery(hit.label);
      if (cp) {
        setCpQuery(cp);
        void loadByPostalCode(cp);
        return;
      }
      setCpQuery("");
      activeCpRef.current = null;
      setActiveCp(null);
      void loadByArea(hit, null);
    },
    [loadByPostalCode, loadByArea]
  );

  /** El buscador es controlado: al escribir se limpia el resultado anterior. */
  const onLocationQueryChange = useCallback((q: string) => {
    setLocationQuery(q);
  }, []);

  const loadMap = useCallback(
    async (bbox: [number, number, number, number], meta?: { zoom: number }) => {
      lastBboxRef.current = bbox;
      const zoom = meta?.zoom ?? lastZoomRef.current;
      if (meta?.zoom != null) lastZoomRef.current = meta.zoom;
      const seq = ++mapLoadSeq.current;
      if (!activeCpRef.current && zoom < EXPLORAR_MIN_ZOOM_FOR_BBOX) {
        if (seq === mapLoadSeq.current) setListings([]);
        return;
      }
      const [minLng, minLat, maxLng, maxLat] = bbox;
      const zoomQ = meta?.zoom != null ? `&zoom=${meta.zoom}` : "";
      const cpQ = activeCpRef.current ? `&cp=${activeCpRef.current}` : "";
      const filterQ = mapListingFiltersToSearchParams(filters);
      const res = await fetch(
        `/api/map/listings?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}${zoomQ}${cpQ}${filterQ}`
      );
      if (seq !== mapLoadSeq.current) return;
      if (res.ok) {
        const data = (await res.json()) as { features: ListingPin[] };
        setListings(data.features ?? []);
      }
      void loadCensus(bbox, zoom);
    },
    [loadCensus, filters]
  );

  useEffect(() => {
    const bbox = lastBboxRef.current;
    if (bbox) void loadMap(bbox, { zoom: lastZoomRef.current });
  }, [filters, loadMap]);

  useEffect(() => {
    const bbox = lastBboxRef.current;
    if (bbox) void loadCensus(bbox, lastZoomRef.current);
  }, [showIneLayer, loadCensus]);

  const listingIds = useMemo(() => {
    const ids = listings.slice(0, 55).map((l) => l.id);
    if (selected && !ids.includes(selected)) ids.push(selected);
    return ids;
  }, [listings, selected]);
  const { summaries, loading: summariesLoading } = useListingSummaries(listingIds, {
    mode: summaryMode,
    detailId: selected,
  });

  const filteredListings = useMemo(
    () =>
      applyListingViewPipeline(
        listings.map((l) => ({
          ...l,
          source_portal: l.source,
          sourceUrl: l.sourceUrl ?? undefined,
          roi: l.roi,
          rentConfidence: l.rentConfidence,
          scrapedAt: l.scrapedAt,
        })),
        filters,
        sort,
        summaries
      ),
    [listings, filters, sort, summaries]
  );

  const portalSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of filteredListings) {
      const key = l.source ?? "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const parts = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([key, n]) => `${portalBadge(key).name} ${n}`);
    return parts.length > 0 ? parts.join(" · ") : null;
  }, [filteredListings]);

  async function requestCoverage() {
    const bbox = lastBboxRef.current;
    if (!bbox) return;
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const res = await fetch("/api/map/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minLng, minLat, maxLng, maxLat, note: "Explorar sin pins" }),
    });
    if (res.ok) setRequestSent(true);
  }

  const roiPins = useMemo(
    () =>
      filteredListings.map((l) => ({
        id: l.id,
        lng: l.lng,
        lat: l.lat,
        roi: l.roi,
        price: l.price,
        rentEst: l.rentEst ?? null,
        rentConfidence: l.rentConfidence ?? null,
        geocodeQuality: l.geocodeQuality ?? null,
      })),
    [filteredListings]
  );

  const selectedListing = useMemo((): SidePanelListing | null => {
    if (!selected) return null;
    const l = filteredListings.find((x) => x.id === selected) ?? listings.find((x) => x.id === selected);
    if (l) {
      return {
        id: l.id,
        title: l.title,
        price: l.price,
        city: l.city,
        sourcePortal: l.source,
        thumbnailUrl: l.thumbnailUrl,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        sqm: l.sqm,
        roi: l.roi,
        rentEst: l.rentEst ?? null,
        sourceUrl: l.sourceUrl,
      };
    }
    const pin = roiPins.find((p) => p.id === selected);
    if (pin) return pinFallbackListing(selected, pin);
    return null;
  }, [selected, filteredListings, listings, roiPins]);

  const mapMode = viewMode === "map";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <aside
        className={`flex min-h-0 flex-col border-r border-neutral-200 bg-[#f3f2ef] ${
          mapMode ? "hidden w-full shrink-0 lg:flex lg:w-[min(380px,34vw)]" : "min-w-0 flex-1 lg:max-w-none lg:flex-[1.2]"
        }`}
      >
        <AppPanelHeader
          title="Explorar mercado"
          subtitle={
            listings.length === 0
              ? "Importa un CP (5 dígitos) o acerca el mapa (zoom 11+) — sin catálogo nacional"
              : filteredListings.length === listings.length
                ? `${listings.length} ventas${portalSummary ? ` · ${portalSummary}` : ""}`
                : `${filteredListings.length} de ${listings.length} ventas${portalSummary ? ` · ${portalSummary}` : ""}`
          }
          action={
            <div className="flex flex-wrap gap-2">
              {activeCp && (
                <Link
                  href={oportunidadesHrefFromFilters(filters, { cp: activeCp })}
                  className="inline-block rounded border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-950 hover:bg-orange-100"
                >
                  Oportunidades · CP {activeCp}
                </Link>
              )}
              <Link
                href="/app/scan/nuevo"
                className="inline-block rounded bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white"
              >
                Nuevo scan ROI
              </Link>
            </div>
          }
        />
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <SpainLocationSearch
            value={locationQuery}
            onChange={onLocationQueryChange}
            onPick={onLocationPick}
            placeholder="CP, barrio o municipio"
          />
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="CP directo (5 dígitos)"
              value={cpQuery}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 5);
                setCpQuery(v);
                if (v.length === 5) setLocationQuery(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && cpQuery.length === 5) void loadByPostalCode();
              }}
              className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={cpQuery.length !== 5 || cpLoading}
              onClick={() => void loadByPostalCode()}
              className="shrink-0 rounded-lg bg-neutral-950 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
            >
              {cpLoading ? "Importando…" : "Importar CP"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-800"
          >
            Filtros avanzados
            <span className="text-neutral-400">{filtersOpen ? "▾" : "▸"}</span>
          </button>
          <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5 text-[11px]">
            {(
              [
                ["list", "Listado"],
                ["grid", "Grid"],
                ["map", "Mapa"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`flex-1 rounded-md px-2 py-1.5 font-medium ${
                  viewMode === mode ? "bg-orange-600 text-white" : "text-neutral-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {filtersOpen && (
            <ListingFiltersPanel
              compact
              filters={filters}
              onChange={setFilters}
              sort={sort}
              onSortChange={setSort}
              matchedCount={filteredListings.length}
              totalCount={listings.length}
              onReset={() => {
                setFilters(defaultListingFilters());
                setSort("score_desc");
              }}
            />
          )}
          {!mapMode && filteredListings.length === 0 && listings.length > 0 && (
            <button
              type="button"
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium"
              onClick={() => setFilters(defaultListingFilters())}
            >
              Quitar filtros estrictos ({listings.length} en CP)
            </button>
          )}
          {cpSummary && (
            <p className="text-xs text-neutral-700">
              {cpSummary} — scrape en vivo (España), no inventario antiguo
            </p>
          )}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-800">
            <input
              type="checkbox"
              checked={showIneLayer}
              onChange={(e) => setShowIneLayer(e.target.checked)}
              className="accent-violet-700"
            />
            Capa INE (secciones censales) — zoom ≥ 11 · piloto Barcelona
          </label>
          {showIneLayer && censusStatus === "zoom" && (
            <p className="text-[11px] text-neutral-600">Acerca el mapa (zoom 11+) para ver secciones INE.</p>
          )}
          {showIneLayer && censusStatus === "empty" && (
            <p className="text-[11px] text-amber-900">
              Sin secciones INE en esta vista (piloto: 4 barrios de Barcelona ciudad).
            </p>
          )}
          {showIneLayer && censusStatus === "error" && (
            <p className="text-[11px] text-red-800">Capa INE no disponible (migración o red).</p>
          )}
          {showIneLayer && censusStatus === "ok" && (
            <p className="text-[11px] text-violet-800">Secciones INE visibles (contorno violeta).</p>
          )}
          {listings.length === 0 && (
            <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
              <p className="font-medium text-neutral-900">Empieza por una zona</p>
              <p className="mt-2 leading-relaxed">
                Escribe un código postal arriba (cualquier CP de España). También puedes acercar el mapa en una
                ciudad (zoom {Math.ceil(EXPLORAR_MIN_ZOOM_FOR_BBOX)}+).
              </p>
              {activeCp && (
                <Link
                  href={oportunidadesHrefFromFilters(filters, { cp: activeCp })}
                  className="mt-3 inline-block text-xs font-semibold text-orange-700 underline"
                >
                  Ver oportunidades en CP {activeCp} →
                </Link>
              )}
              <button
                type="button"
                disabled={requestSent}
                onClick={() => void requestCoverage()}
                className="mt-3 block rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 disabled:opacity-50"
              >
                {requestSent ? "Solicitud enviada" : "Solicitar cobertura en el mapa actual"}
              </button>
            </div>
          )}
          {listings.length > 0 && filteredListings.length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Ningún anuncio cumple los filtros. Amplía precio, ROI o portales.
            </p>
          )}
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                : viewMode === "list"
                  ? "flex flex-col gap-3"
                  : "hidden"
            }
          >
            {filteredListings.map((l) => (
              <PremiumListingCard
                key={l.id}
                listingId={l.id}
                title={decodeListingTitle(l.title ?? "Inmueble")}
                city={l.city}
                price={l.price}
                sourcePortal={l.source}
                thumbnailUrl={l.thumbnailUrl}
                bedrooms={l.bedrooms}
                bathrooms={l.bathrooms}
                sqm={l.sqm}
                roi={l.roi}
                rentEst={l.rentEst}
                sourceUrl={l.sourceUrl ?? undefined}
                scrapedAt={l.scrapedAt}
                markedOpportunity={l.isOpportunity === true}
                selected={selected === l.id}
                onHover={() => setSelected(l.id)}
                onSelect={() => setSelected(l.id)}
                compact
                summary={summaries[l.id] ?? null}
                summaryLoading={summariesLoading}
                returnTo={explorarReturnTo}
              />
            ))}
          </div>
        </div>
      </aside>
      <div className={`relative min-h-0 min-w-0 overflow-hidden ${mapMode ? "flex flex-1" : "hidden"}`}>
        <RoiScanMap
          pins={roiPins}
          selectedId={selected}
          onSelectPin={setSelected}
          onBboxChange={loadMap}
          flyTo={flyTo}
          initialView={SPAIN_VIEW}
          maxPins={200}
          censusOverlay={censusOverlay}
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
        summaryMode={summaryMode}
        onSummaryModeChange={setSummaryMode}
        listing={selectedListing}
        summary={selected ? (summaries[selected] ?? null) : null}
        summaryLoading={summariesLoading}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

export default function ExplorarPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center p-8 text-sm text-neutral-600">Cargando explorar…</div>}>
      <ExplorarPageContent />
    </Suspense>
  );
}
