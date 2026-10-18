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
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Pin = { id: string; lng: number; lat: number; roi: number | null; price: number };
type GeocodeHit = { label: string; lat: number; lng: number; bbox: [number, number, number, number] | null };

type FilterMode = "entry_budget" | "price_range";

export default function NewScanPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pins, setPins] = useState<Pin[]>([]);
  const [polygon, setPolygon] = useState<ScanPolygon | null>(null);
  const [locationMode, setLocationMode] = useState<"search" | "draw">("search");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeHit[]>([]);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lng: number; lat: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(1.5);
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

  const zoneReady = Boolean(polygon || (center && locationMode === "search"));

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
    if (locationMode !== "search" || !center) return;
    setPolygon(circlePolygon(center.lng, center.lat, radiusKm));
  }, [center, radiusKm, locationMode]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) return;
      const data = (await res.json()) as { results: GeocodeHit[] };
      setSuggestions(data.results ?? []);
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  const loadMap = useCallback(async (bbox: [number, number, number, number]) => {
    visibleBboxRef.current = bbox;
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const res = await fetch(
      `/api/map/listings?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}`
    );
    if (!res.ok) return;
    const data = (await res.json()) as { features: Pin[] };
    setPins(data.features ?? []);
  }, []);

  function pickPlace(hit: GeocodeHit) {
    setQuery(hit.label.split(",")[0] ?? hit.label);
    setPlaceLabel(hit.label);
    setSuggestions([]);
    setCenter({ lng: hit.lng, lat: hit.lat });
    const zoom = hit.bbox
      ? Math.min(
          15,
          Math.max(11, 13 - Math.log2(Math.max(hit.bbox[2] - hit.bbox[0], hit.bbox[3] - hit.bbox[1]) * 80))
        )
      : 13;
    setFlyTo({ center: [hit.lng, hit.lat], zoom });
    setPolygon(circlePolygon(hit.lng, hit.lat, radiusKm));
  }

  async function startScan() {
    setLoading(true);
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
      setLoading(false);
      alert(body.error ?? "Error al crear scan");
      return;
    }
    const runRes = await fetch(`/api/scans/${body.scanId}/run`, { method: "POST" });
    setLoading(false);
    if (!runRes.ok && runRes.status !== 202) {
      const runBody = (await runRes.json().catch(() => ({}))) as { error?: string };
      alert(runBody.error ?? "El scan no pudo ejecutarse. Revisa la zona e inténtalo de nuevo.");
      return;
    }
    router.push(`/app/scan/${body.scanId}`);
  }

  const zoneVisual = locationMode === "draw" ? "drawn" : "radius";

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <aside className="flex min-h-0 w-full max-w-[440px] shrink-0 flex-col border-r border-neutral-200 bg-white lg:w-[440px]">
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <h1 className="text-lg font-semibold text-neutral-950">
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
                <div className="rounded-lg border border-neutral-200 bg-[#f7f6f3] px-3 py-2 text-sm">
                  España · EUR (€)
                </div>
                <div className="rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-500">
                  Fuentes: kelify · pisos.com · Hipoges · Solvia · Fotocasa · habitaclia
                </div>
              </div>
              <div className="flex rounded-lg border border-neutral-200 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setLocationMode("search");
                    setSelectedPinId(null);
                  }}
                  className={`flex-1 rounded-md py-2 text-sm font-medium ${locationMode === "search" ? "bg-neutral-950 text-white" : "text-neutral-700"}`}
                >
                  Buscar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocationMode("draw");
                    setCenter(null);
                    setPolygon(null);
                    setPlaceLabel(null);
                    setSelectedPinId(null);
                  }}
                  className={`flex-1 rounded-md py-2 text-sm font-medium ${locationMode === "draw" ? "bg-neutral-950 text-white" : "text-neutral-700"}`}
                >
                  Dibujar área
                </button>
              </div>
              {locationMode === "search" ? (
                <div className="relative">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && suggestions[0]) {
                        e.preventDefault();
                        pickPlace(suggestions[0]);
                      }
                    }}
                    placeholder="CP (5 dígitos) o barrio — ej. 08906, Castellón"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
                  />
                  {suggestions.length > 0 && (
                    <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-white shadow-lg">
                      {suggestions.map((s, idx) => (
                        <li key={`${s.lat},${s.lng},${idx}`}>
                          <button
                            type="button"
                            onClick={() => pickPlace(s)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100"
                          >
                            {s.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="space-y-2 text-sm text-neutral-600">
                  <p>Dibuja el polígono en el mapa (solo España).</p>
                  <p className="text-xs text-neutral-500">
                    Mínimo 3 clics en el mapa → «Cerrar zona» o doble clic. Los pins del mapa se
                    seleccionan con un clic normal.
                  </p>
                  {polygon && (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                      Zona cerrada — ya puedes pulsar Siguiente.
                    </p>
                  )}
                </div>
              )}
              {placeLabel && locationMode === "search" && (
                <p className="rounded-lg border border-neutral-200 bg-[#f7f6f3] px-3 py-2 text-sm text-neutral-800">
                  Encontrado — área ~{areaKm2.toFixed(1)} km² (radio {radiusKm} km)
                </p>
              )}
              {selectedPinId && locationMode === "search" && (
                <p className="rounded-lg border border-neutral-200 bg-[#f7f6f3] px-3 py-2 text-sm text-neutral-800">
                  Pin seleccionado — centro del scan en ese inmueble (radio {radiusKm} km). Pulsa
                  Siguiente cuando quieras.
                </p>
              )}
              {locationMode === "search" && (
                <RangeField
                  label="Radio de búsqueda"
                  value={radiusKm}
                  min={0.5}
                  max={5}
                  step={0.1}
                  suffix=" km"
                  onChange={setRadiusKm}
                />
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
              <p className="rounded-lg bg-[#f7f6f3] p-3 text-sm text-neutral-700">
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
                Avísame por correo cuando termine (requiere Resend — próximamente)
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

          <p className="mt-6 text-center text-xs text-neutral-400">
            <Link href="/app/explorar" className="font-medium text-neutral-950 underline">
              Explorar inventario en mapa
            </Link>
          </p>
        </div>
      </aside>

      <div className="relative min-h-0 flex-1">
        <RoiScanMap
          drawMode={step === 0 && locationMode === "draw"}
          polygon={polygon}
          zoneVisual={zoneVisual}
          centerMarker={center}
          onPolygonChange={(p) => {
            setPolygon(p);
            if (p) setPlaceLabel("Zona dibujada (España)");
            else if (locationMode === "draw") setPlaceLabel(null);
          }}
          initialView={SPAIN_VIEW}
          autoFitPolygon={Boolean(polygon && step === 0)}
          pins={pins}
          selectedId={selectedPinId}
          onSelectPin={(id) => {
            setSelectedPinId(id);
            const pin = pins.find((x) => x.id === id);
            if (!pin) return;
            if (locationMode === "search") {
              setCenter({ lng: pin.lng, lat: pin.lat });
              setPolygon(circlePolygon(pin.lng, pin.lat, radiusKm));
              setPlaceLabel(
                `Inmueble · ${pin.price.toLocaleString("es-ES")} €${
                  pin.roi != null ? ` · ${pin.roi.toFixed(1)}% ROI` : ""
                }`
              );
              setFlyTo({ center: [pin.lng, pin.lat], zoom: 15 });
            }
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
