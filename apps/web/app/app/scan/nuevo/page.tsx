"use client";

import { AffordabilityCard } from "@/components/investment/AffordabilityCard";
import { RoiScanMap } from "@/components/map/RoiScanMapLazy";
import { ScanWizardSteps } from "@/components/scan/ScanWizardSteps";
import { Badge } from "@/components/ui/Badge";
import { RangeField } from "@/components/ui/RangeField";
import { circleAreaKm2, circlePolygon } from "@/lib/map/circle-polygon";
import { SPAIN_VIEW } from "@/lib/map/spain-bounds";
import {
  SCAN_OPERATIONS,
  scanOperationUsesRoi,
  type ScanOperation,
} from "@/lib/investment/operations";
import {
  bathroomFilterFromToggles,
  bedroomFilterFromRooms,
} from "@/lib/scan/bedroom-filter";
import {
  defaultPortalToggles,
  SCAN_PORTALS,
  selectedPortals,
} from "@/lib/scan/portal-options";
import { DEMO_POLYGON } from "@/lib/scan/demo-polygon";
import type { ScanPolygon } from "@/lib/scan/types";
import { maxPurchasePriceFromCash } from "@pi/roi-engine";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SpainLocationSearch } from "@/components/location/SpainLocationSearch";
import { filtersFromUrlSearchParams } from "@/lib/filters/url-sync";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Pin = { id: string; lng: number; lat: number; roi: number | null; price: number };
type GeocodeHit = { label: string; lat: number; lng: number; bbox: [number, number, number, number] | null };

function cpFromGeocodeLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  return /CP\s*(\d{5})/i.exec(label)?.[1] ?? null;
}

type FilterMode = "entry_budget" | "price_range";

export default function NewScanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center p-8 text-sm text-neutral-600">
          Cargando asistente de scan…
        </div>
      }
    >
      <NewScanPageContent />
    </Suspense>
  );
}

function NewScanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlFiltersReady = useRef(false);
  const [step, setStep] = useState(0);
  const [pins, setPins] = useState<Pin[]>([]);
  const [polygon, setPolygon] = useState<ScanPolygon | null>(null);
  const [query, setQuery] = useState("");
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lng: number; lat: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(2);
  const [flyTo, setFlyTo] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState<ScanOperation>("buy_to_rent");
  const [filterMode, setFilterMode] = useState<FilterMode>("price_range");
  const [leverage, setLeverage] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [rooms, setRooms] = useState({
    studio: false,
    r1: true,
    r2: true,
    r3: true,
    r4: true,
  });
  const [finance, setFinance] = useState({
    entryBudget: 50_000,
    downPct: 20,
    taxPct: 7.7,
    ratePct: 2,
    years: 20,
    priceMin: 100_000,
    priceMax: 350_000,
  });
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(true);
  const [bathrooms, setBathrooms] = useState({
    b1: true,
    b2: true,
    b3: true,
    b4: true,
  });
  const [sqmMin, setSqmMin] = useState(20);
  const [sqmMax, setSqmMax] = useState(200);
  const [portalToggles, setPortalToggles] = useState(defaultPortalToggles);
  const [minRoiGross, setMinRoiGross] = useState(0);
  const [onlyWithRoi, setOnlyWithRoi] = useState(false);

  const visibleBboxRef = useRef<[number, number, number, number] | null>(null);
  const stepRef = useRef(step);
  stepRef.current = step;

  const zoneReady = Boolean(center && polygon);

  const areaKm2 = useMemo(() => circleAreaKm2(radiusKm), [radiusKm]);

  const maxPriceFromBudget = useMemo(
    () =>
      maxPurchasePriceFromCash({
        cashBudget: finance.entryBudget,
        downPaymentPct: finance.downPct,
        transferTaxPct: finance.taxPct,
      }),
    [finance.entryBudget, finance.downPct, finance.taxPct]
  );

  const effectivePriceMax =
    filterMode === "entry_budget"
      ? Math.min(Math.round(maxPriceFromBudget), finance.priceMax)
      : finance.priceMax;
  const effectivePriceMin =
    filterMode === "entry_budget" ? Math.max(0, finance.priceMin) : finance.priceMin;

  const bedroomFilter = useMemo(() => bedroomFilterFromRooms(rooms), [rooms]);
  const bathroomFilter = useMemo(() => bathroomFilterFromToggles(bathrooms), [bathrooms]);
  const bedroomsMin = bedroomFilter.bedroomsMin;
  const usesRoi = scanOperationUsesRoi(operation);

  useEffect(() => {
    if (!center) return;
    setPolygon(circlePolygon(center.lng, center.lat, radiusKm));
  }, [center, radiusKm]);

  useEffect(() => {
    if (urlFiltersReady.current) return;
    urlFiltersReady.current = true;
    const fromUrl = filtersFromUrlSearchParams(searchParams);
    if (fromUrl.priceMin != null && fromUrl.priceMin > 0) {
      setFinance((f) => ({ ...f, priceMin: fromUrl.priceMin! }));
    }
    if (fromUrl.priceMax != null && fromUrl.priceMax > 0 && fromUrl.priceMax < 2_000_000) {
      setFinance((f) => ({ ...f, priceMax: fromUrl.priceMax! }));
      setFilterMode("price_range");
    }
    if (fromUrl.minRoiGross != null && fromUrl.minRoiGross > 0) {
      setMinRoiGross(fromUrl.minRoiGross);
    }
    if (fromUrl.onlyWithRoi) setOnlyWithRoi(true);
    if (searchParams.get("notify") === "1") setNotifyEmail(true);

    const cp = searchParams.get("cp")?.replace(/\D/g, "").slice(0, 5);
    const q = cp ?? searchParams.get("q")?.trim();
    if (!q) return;

    void (async () => {
      setQuery(q);
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { results?: GeocodeHit[] };
      const hit = data.results?.[0];
      if (!hit) return;
      pickPlaceRef.current(hit);
    })();
  }, [searchParams]);

  const pickPlaceRef = useRef<(hit: GeocodeHit) => void>(() => {});

  const loadMap = useCallback(async (bbox: [number, number, number, number]) => {
    if (stepRef.current !== 0) return;
    visibleBboxRef.current = bbox;
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const res = await fetch(
      `/api/map/listings?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}`
    );
    if (!res.ok) return;
    const data = (await res.json()) as { features: Pin[] };
    const next = data.features ?? [];
    setPins((prev) => {
      if (prev.length === next.length && prev.every((p, i) => p.id === next[i]?.id)) return prev;
      return next;
    });
  }, []);

  const polygonFitKey = useMemo(
    () => (center ? `${center.lng.toFixed(5)},${center.lat.toFixed(5)}` : null),
    [center]
  );

  const applyScanCenter = useCallback((lng: number, lat: number, label?: string) => {
    setCenter({ lng, lat });
    setPolygon(circlePolygon(lng, lat, radiusKm));
    if (label) setPlaceLabel(label);
    else setPlaceLabel("Zona señalada en mapa");
  }, [radiusKm]);

  function pickPlace(hit: GeocodeHit) {
    const cp = cpFromGeocodeLabel(hit.label);
    setQuery(cp ?? hit.label.split(",")[0] ?? hit.label);
    setSelectedPinId(null);
    applyScanCenter(hit.lng, hit.lat, hit.label);
    const zoom = hit.bbox
      ? Math.min(
          15,
          Math.max(11, 13 - Math.log2(Math.max(hit.bbox[2] - hit.bbox[0], hit.bbox[3] - hit.bbox[1]) * 80))
        )
      : 13;
    setFlyTo({ center: [hit.lng, hit.lat], zoom });
  }

  pickPlaceRef.current = pickPlace;

  async function startScan() {
    setLoading(true);
    try {
      const zone = polygon ?? DEMO_POLYGON;
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          polygon: zone,
          operation,
          filters: {
            priceMin: effectivePriceMin,
            priceMax: effectivePriceMax,
            bedroomsMin,
            allowedBedrooms: bedroomFilter.allowedBedrooms,
            bedroomsMinPlus: bedroomFilter.bedroomsMinPlus,
            allowedBathrooms: bathroomFilter.allowedBathrooms,
            bathroomsMinPlus: bathroomFilter.bathroomsMinPlus,
            sqmMin,
            sqmMax,
            sourcePortals: selectedPortals(portalToggles),
            minRoiGross: usesRoi ? minRoiGross : undefined,
            onlyWithRoi: usesRoi ? onlyWithRoi : false,
            rooms,
            bathrooms,
            filterMode,
            leverage,
            notifyEmail,
            finance,
            radiusKm,
            center,
          },
        }),
      });
      const body = (await res.json()) as { scanId?: string; error?: string };
      if (!res.ok || !body.scanId) {
        alert(body.error ?? "Error al crear scan");
        return;
      }
      router.push(`/app/scan/${body.scanId}`);
    } catch {
      alert("Error de red al crear el scan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <aside className="flex min-h-0 w-full max-w-[440px] shrink-0 flex-col border-r border-neutral-200 bg-white lg:w-[440px]">
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
            Encuentra inmuebles que generan dinero
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Escanea cualquier barrio. ROI, financiación y ranking buy-to-let en España.
          </p>
          <div className="mt-4">
            <ScanWizardSteps step={step} />
          </div>

          {step === 0 && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-neutral-200 bg-[#f3f2ef] px-3 py-2 text-sm">
                  España · EUR (€)
                </div>
                <div className="rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-500">
                  Fuentes: kelify · pisos.com · Hipoges · Solvia · Fotocasa · habitaclia
                </div>
              </div>
              <p className="text-sm text-neutral-600">
                Busca un CP o barrio, <strong className="font-medium text-neutral-900">haz un clic en el mapa</strong>{" "}
                o elige un piso. El área azul es un círculo — no hace falta dibujar vértices.
              </p>
              <SpainLocationSearch value={query} onChange={setQuery} onPick={pickPlace} />
              {placeLabel && (
                <p className="rounded-lg border border-neutral-200 bg-[#f3f2ef] px-3 py-2 text-sm text-neutral-800">
                  {placeLabel} · ~{areaKm2.toFixed(1)} km² (radio {radiusKm} km)
                </p>
              )}
              {selectedPinId && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  Centro en el piso seleccionado — puedes mover la zona con otro clic en el mapa.
                </p>
              )}
              {radiusKm < 2 && (
                <p className="text-xs text-neutral-600">
                  Recomendado ≥ 2 km para importar cientos de ventas del barrio.
                </p>
              )}
              <RangeField
                label="Tamaño del área (radio)"
                value={radiusKm}
                min={0.8}
                max={5}
                step={0.2}
                suffix=" km"
                onChange={setRadiusKm}
              />
              <div className="flex flex-wrap gap-2">
                {[1.5, 2, 2.5, 3].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadiusKm(r)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      Math.abs(radiusKm - r) < 0.05
                        ? "border-neutral-950 bg-neutral-950 text-white"
                        : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                    }`}
                  >
                    {r} km
                  </button>
                ))}
              </div>
              {!center && (
                <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-500">
                  Elige ubicación para continuar (buscador, mapa o pin).
                </p>
              )}
              <button
                type="button"
                disabled={!zoneReady}
                onClick={() => setStep(1)}
                className="w-full rounded-lg bg-neutral-950 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="mt-6 space-y-3">
              <p className="text-sm font-medium text-neutral-800">Operación — elige estrategia</p>
              <div className="flex flex-wrap gap-2">
                {SCAN_OPERATIONS.map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    disabled={!op.enabled}
                    onClick={() => op.enabled && setOperation(op.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      operation === op.id
                        ? "border-neutral-950 bg-neutral-950 text-white"
                        : op.enabled
                          ? "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-950"
                          : "cursor-not-allowed border-neutral-200 text-neutral-400"
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
              <p className="rounded-lg bg-[#f3f2ef] p-3 text-sm text-neutral-700">
                {SCAN_OPERATIONS.find((o) => o.id === operation)?.description}
              </p>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setStep(0)} className="flex-1 rounded-lg border py-2.5 text-sm">
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 rounded-lg bg-neutral-950 py-2.5 text-sm font-semibold text-white"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mt-6 space-y-5">
              <p className="text-sm text-neutral-600">
                {usesRoi
                  ? "Precio, tamaño y financiación. ROI bruto sobre alquiler estimado; con apalancamiento, también cash-on-cash."
                  : "Precio y características del inmueble. Listado por precio — sin estimación de alquiler."}
              </p>

              <RangeField
                label="Precio de compra (máx.)"
                value={filterMode === "price_range" ? finance.priceMax : effectivePriceMax}
                min={50_000}
                max={1_500_000}
                step={5_000}
                suffix=" €"
                onChange={(v) => {
                  setFilterMode("price_range");
                  setFinance((f) => ({ ...f, priceMax: v }));
                }}
              />
              <RangeField
                label="Precio de compra (mín.)"
                value={effectivePriceMin}
                min={0}
                max={Math.max(50_000, finance.priceMax)}
                step={5_000}
                suffix=" €"
                onChange={(v) => {
                  setFilterMode("price_range");
                  setFinance((f) => ({ ...f, priceMin: v }));
                }}
              />

              <div>
                <p className="mb-2 text-sm font-medium">Habitaciones</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["studio", "Estudio"],
                      ["r1", "1 hab."],
                      ["r2", "2 hab."],
                      ["r3", "3 hab."],
                      ["r4", "4+ hab."],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1 text-xs has-[:checked]:border-neutral-950 has-[:checked]:bg-neutral-950 has-[:checked]:text-white"
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={rooms[key]}
                        onChange={(e) => setRooms((r) => ({ ...r, [key]: e.target.checked }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMoreFiltersOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-800"
              >
                Más filtros
                <span className="text-neutral-400">{moreFiltersOpen ? "▾" : "▸"}</span>
              </button>

              {moreFiltersOpen && (
                <div className="space-y-4 rounded-lg border border-neutral-200 bg-[#fafaf9] p-3">
                  <div>
                    <p className="mb-2 text-sm font-medium">Baños</p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["b1", "1 baño"],
                          ["b2", "2 baños"],
                          ["b3", "3 baños"],
                          ["b4", "4+ baños"],
                        ] as const
                      ).map(([key, label]) => (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1 text-xs has-[:checked]:border-neutral-950 has-[:checked]:bg-neutral-950 has-[:checked]:text-white"
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={bathrooms[key]}
                            onChange={(e) =>
                              setBathrooms((b) => ({ ...b, [key]: e.target.checked }))
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <RangeField
                    label="Tamaño mínimo"
                    value={sqmMin}
                    min={15}
                    max={400}
                    step={5}
                    suffix=" m²"
                    onChange={setSqmMin}
                  />
                  <RangeField
                    label="Tamaño máximo"
                    value={sqmMax}
                    min={sqmMin}
                    max={800}
                    step={5}
                    suffix=" m²"
                    onChange={setSqmMax}
                  />
                  <div>
                    <p className="mb-2 text-sm font-medium">Portales</p>
                    <div className="flex flex-wrap gap-2">
                      {SCAN_PORTALS.map((p) => (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1 text-xs has-[:checked]:border-neutral-950 has-[:checked]:bg-neutral-950 has-[:checked]:text-white"
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={portalToggles[p.id]}
                            onChange={(e) =>
                              setPortalToggles((t) => ({ ...t, [p.id]: e.target.checked }))
                            }
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  {usesRoi && (
                    <>
                      <RangeField
                        label="ROI bruto mínimo"
                        value={minRoiGross}
                        min={0}
                        max={15}
                        step={0.5}
                        suffix=" %"
                        onChange={setMinRoiGross}
                      />
                      <label className="flex items-center gap-2 text-xs text-neutral-700">
                        <input
                          type="checkbox"
                          checked={onlyWithRoi}
                          onChange={(e) => setOnlyWithRoi(e.target.checked)}
                          className="h-4 w-4 accent-neutral-950"
                        />
                        Solo inmuebles con alquiler estimado
                      </label>
                    </>
                  )}
                </div>
              )}

              {usesRoi && (
                <>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-3">
                <span className="text-sm font-medium">Usar apalancamiento (hipoteca)</span>
                <input
                  type="checkbox"
                  checked={leverage}
                  onChange={(e) => setLeverage(e.target.checked)}
                  className="h-4 w-4 accent-neutral-950"
                />
              </label>
              {!leverage && (
                <p className="text-xs text-neutral-500">
                  ROI calculado sobre inversión en efectivo (entrada + impuestos de compra).
                </p>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Modo de filtro</p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="filterMode"
                    checked={filterMode === "entry_budget"}
                    onChange={() => setFilterMode("entry_budget")}
                  />
                  Modo alcance de entrada (presupuesto efectivo)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="filterMode"
                    checked={filterMode === "price_range"}
                    onChange={() => setFilterMode("price_range")}
                  />
                  Modo rango de precio de compra
                </label>
              </div>

              {filterMode === "entry_budget" ? (
                <>
                  <RangeField
                    label="Tu presupuesto de entrada (efectivo)"
                    value={finance.entryBudget}
                    min={10_000}
                    max={500_000}
                    step={5_000}
                    suffix="€"
                    onChange={(v) => setFinance((f) => ({ ...f, entryBudget: v }))}
                  />
                  <RangeField
                    label="Porcentaje de entrada"
                    value={finance.downPct}
                    min={10}
                    max={100}
                    step={1}
                    suffix="%"
                    hint="Capital propio sobre el precio de compra."
                    onChange={(v) => setFinance((f) => ({ ...f, downPct: v }))}
                  />
                  <RangeField
                    label="Impuestos compra (ITP / similar)"
                    value={finance.taxPct}
                    min={0}
                    max={15}
                    step={0.1}
                    suffix="%"
                    onChange={(v) => setFinance((f) => ({ ...f, taxPct: v }))}
                  />
                  {leverage && (
                    <>
                      <RangeField
                        label="Tipo interés hipoteca"
                        value={finance.ratePct}
                        min={0}
                        max={10}
                        step={0.1}
                        suffix="%"
                        onChange={(v) => setFinance((f) => ({ ...f, ratePct: v }))}
                      />
                      <RangeField
                        label="Plazo hipoteca"
                        value={finance.years}
                        min={5}
                        max={35}
                        step={1}
                        suffix=" años"
                        onChange={(v) => setFinance((f) => ({ ...f, years: v }))}
                      />
                    </>
                  )}
                  <AffordabilityCard
                    cashBudget={finance.entryBudget}
                    downPct={finance.downPct}
                    taxPct={finance.taxPct}
                    ratePct={finance.ratePct}
                    years={finance.years}
                    leverage={leverage}
                  />
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-neutral-500">
                    Solo se incluirán anuncios entre el precio mín. y máx. (venta en portales).
                  </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-neutral-600">
                    Precio mín.
                    <input
                      type="number"
                      value={finance.priceMin}
                      onChange={(e) => {
                        setFilterMode("price_range");
                        setFinance((f) => ({ ...f, priceMin: Number(e.target.value) }));
                      }}
                      className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
                    />
                  </label>
                  <label className="text-xs text-neutral-600">
                    Precio máx.
                    <input
                      type="number"
                      value={finance.priceMax}
                      onChange={(e) => {
                        setFilterMode("price_range");
                        setFinance((f) => ({ ...f, priceMax: Number(e.target.value) }));
                      }}
                      className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
                    />
                  </label>
                </div>
                </div>
              )}
                </>
              )}

              <label className="flex items-center gap-2 text-xs text-neutral-600">
                <input
                  type="checkbox"
                  checked={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.checked)}
                />
                Avísame por correo cuando termine (requiere cuenta con email y Resend en prod)
              </label>

              <p className="text-xs text-neutral-500">
                Scan: {effectivePriceMin.toLocaleString("es-ES")}–
                {effectivePriceMax.toLocaleString("es-ES")} € · {sqmMin}–{sqmMax} m² · dorm.{" "}
                {bedroomsMin}+
                {usesRoi && minRoiGross > 0 ? ` · ROI ≥ ${minRoiGross}%` : ""}
              </p>
              <p className="text-xs">
                <Badge tone="success">kelify</Badge>{" "}
                <Badge tone="success">pisos.com</Badge>{" "}
                <Badge tone="success">Hipoges</Badge>{" "}
                <Badge tone="success">Solvia</Badge>{" "}
                <Badge tone="success">Fotocasa</Badge>{" "}
                <Badge tone="success">habitaclia</Badge>
              </p>

              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)} className="flex-1 rounded-lg border py-2.5 text-sm">
                  Atrás
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={startScan}
                  className="flex-1 rounded-lg bg-neutral-950 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {loading ? "Iniciando…" : "Buscar"}
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-2 text-center text-xs">
            <Link
              href="/app/oportunidades"
              className="block rounded-lg bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Ver oportunidades marcadas →
            </Link>
            <Link href="/app/explorar" className="font-medium text-neutral-600 underline">
              Explorar inventario en mapa
            </Link>
          </div>
        </div>
      </aside>

      <div className="relative min-h-0 flex-1">
        <RoiScanMap
          pickCenterMode={step === 0}
          onMapCenterPick={(lng, lat) => {
            setSelectedPinId(null);
            applyScanCenter(lng, lat);
            setFlyTo({ center: [lng, lat], zoom: 14 });
          }}
          polygon={polygon}
          zoneVisual="radius"
          centerMarker={center}
          initialView={SPAIN_VIEW}
          autoFitPolygon={Boolean(polygon && step === 0)}
          polygonFitKey={step === 0 ? polygonFitKey : null}
          pins={pins}
          selectedId={selectedPinId}
          onSelectPin={(id) => {
            setSelectedPinId(id);
            const pin = pins.find((x) => x.id === id);
            if (!pin) return;
            applyScanCenter(
              pin.lng,
              pin.lat,
              `Inmueble · ${pin.price.toLocaleString("es-ES")} €${
                pin.roi != null ? ` · ${pin.roi.toFixed(1)}% ROI` : ""
              }`
            );
            setFlyTo({ center: [pin.lng, pin.lat], zoom: 15 });
          }}
          onBboxChange={loadMap}
          flyTo={flyTo}
          maxPins={72}
          className="absolute inset-0 h-full w-full"
        />
      </div>

      {loading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/80">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
          <p className="mt-3 text-sm font-medium">Recopilando anuncios y ROI…</p>
        </div>
      )}
    </div>
  );
}
