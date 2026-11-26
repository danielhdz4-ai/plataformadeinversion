"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { SpainLocationSearch } from "@/components/location/SpainLocationSearch";
import type { GeocodeHit } from "@/lib/map/geocode-spain";
import type { ListingSort } from "@/components/filters/ListingFiltersPanel";
import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";
import { explorarHrefFromFilters, scanNuevoHrefFromFilters } from "@/lib/filters/url-sync";
import { saveZoneWatch } from "@/lib/zone/zone-watches.client";
import { ALL_SELLER_KINDS } from "@/lib/listing/filter-opportunity";
import { SELLER_KIND_LABEL, type SellerKind } from "@/lib/listing/seller-kind";

type ViewMode = "grid" | "list" | "map";

type Props = {
  filters: ScanRunFilters;
  onChange: (next: ScanRunFilters) => void;
  sort: ListingSort;
  onSortChange: (s: ListingSort) => void;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  locationQuery: string;
  onLocationQueryChange: (q: string) => void;
  onLocationPick: (hit: GeocodeHit) => void;
  activeCp: string | null;
  onClearCp: () => void;
  matchedCount: number;
  catalogTotal: number;
  loading?: boolean;
  zoneImporting?: boolean;
  onRefreshZone?: () => void;
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
  onReset: () => void;
  zoneLabel?: string | null;
  zoneCpNote?: string | null;
};

function SelectPill({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200/90 bg-white px-3 py-1.5 text-[11px] text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <span className="hidden font-medium text-neutral-500 sm:inline">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[7rem] cursor-pointer border-0 bg-transparent p-0 text-[11px] font-semibold text-neutral-900 outline-none focus:ring-0"
      >
        {children}
      </select>
    </label>
  );
}

export function OpportunityFeedToolbar({
  filters,
  onChange,
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
  locationQuery,
  onLocationQueryChange,
  onLocationPick,
  activeCp,
  onClearCp,
  matchedCount,
  catalogTotal,
  loading,
  zoneImporting,
  onRefreshZone,
  advancedOpen,
  onAdvancedOpenChange,
  onReset,
  zoneLabel,
  zoneCpNote,
}: Props) {
  const [watchSaved, setWatchSaved] = useState(false);
  const discountVal =
    filters.minDiscountPct == null || filters.minDiscountPct === 0
      ? "any"
      : String(filters.minDiscountPct);
  const roiVal =
    filters.minRoiGross == null || filters.minRoiGross === 0 ? "any" : String(filters.minRoiGross);
  const scoreVal =
    filters.minOpportunityScore == null || filters.minOpportunityScore === 0
      ? "any"
      : String(filters.minOpportunityScore);
  const priceVal =
    filters.priceMax == null || filters.priceMax >= 2_000_000
      ? "any"
      : String(filters.priceMax);
  const ageVal =
    filters.maxScrapedAgeDays == null || filters.maxScrapedAgeDays === 0
      ? "any"
      : String(filters.maxScrapedAgeDays);

  const sellerVal = filters.sellerKinds?.length === 1 ? filters.sellerKinds[0] : "any";

  return (
    <div className="shrink-0 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 lg:px-8">
        <div className="min-w-[200px] flex-1 basis-[240px]">
          <SpainLocationSearch
            value={locationQuery}
            onChange={onLocationQueryChange}
            onPick={onLocationPick}
            placeholder="Provincia, comarca, municipio, CP…"
            inputClassName="w-full rounded-full border border-neutral-200/90 bg-neutral-50/80 px-4 py-2 text-sm shadow-inner outline-none focus:border-neutral-300 focus:bg-white focus:ring-2 focus:ring-neutral-900/5"
          />
        </div>

        <SelectPill
          label="Descuento"
          value={discountVal}
          onChange={(v) =>
            onChange({ ...filters, minDiscountPct: v === "any" ? 0 : Number(v) })
          }
        >
          <option value="any">Cualquiera</option>
          <option value="5">≥ 5 %</option>
          <option value="10">≥ 10 %</option>
          <option value="15">≥ 15 %</option>
          <option value="20">≥ 20 %</option>
        </SelectPill>

        <SelectPill
          label="Rentab."
          value={roiVal}
          onChange={(v) =>
            onChange({
              ...filters,
              minRoiGross: v === "any" ? 0 : Number(v),
              onlyWithRoi: v !== "any",
            })
          }
        >
          <option value="any">Cualquiera</option>
          <option value="5">≥ 5 %</option>
          <option value="6">≥ 6 %</option>
          <option value="8">≥ 8 %</option>
          <option value="10">≥ 10 %</option>
          <option value="12">≥ 12 %</option>
        </SelectPill>

        <SelectPill
          label="Vendedor"
          value={sellerVal}
          onChange={(v) =>
            onChange({
              ...filters,
              sellerKinds: v === "any" ? undefined : [v as SellerKind],
            })
          }
        >
          <option value="any">Todos</option>
          {ALL_SELLER_KINDS.map((k) => (
            <option key={k} value={k}>
              {SELLER_KIND_LABEL[k as SellerKind]}
            </option>
          ))}
        </SelectPill>

        <SelectPill
          label="Precio"
          value={priceVal}
          onChange={(v) =>
            onChange({
              ...filters,
              priceMax: v === "any" ? 2_000_000 : Number(v),
            })
          }
        >
          <option value="any">Sin tope</option>
          <option value="150000">≤ 150 k€</option>
          <option value="200000">≤ 200 k€</option>
          <option value="350000">≤ 350 k€</option>
          <option value="500000">≤ 500 k€</option>
        </SelectPill>

        <SelectPill
          label="Score"
          value={scoreVal}
          onChange={(v) =>
            onChange({ ...filters, minOpportunityScore: v === "any" ? 0 : Number(v) })
          }
        >
          <option value="any">Cualquiera</option>
          <option value="50">≥ 50</option>
          <option value="60">≥ 60</option>
          <option value="70">≥ 70</option>
          <option value="80">≥ 80</option>
        </SelectPill>

        <SelectPill
          label="Novedad"
          value={ageVal}
          onChange={(v) =>
            onChange({
              ...filters,
              maxScrapedAgeDays: v === "any" ? null : Number(v),
            })
          }
        >
          <option value="any">Cualquier fecha</option>
          <option value="14">≤ 14 días</option>
          <option value="30">≤ 30 días</option>
          <option value="90">≤ 90 días</option>
        </SelectPill>

        <button
          type="button"
          onClick={() => onAdvancedOpenChange(!advancedOpen)}
          className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
            advancedOpen
              ? "border-neutral-900 bg-neutral-900 text-white"
              : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          Más filtros
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 px-4 py-2 lg:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5 text-[11px]">
            {(
              [
                ["grid", "Grid"],
                ["list", "Listado"],
                ["map", "Mapa"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => onViewModeChange(mode)}
                className={`rounded-md px-3 py-1 font-semibold transition ${
                  viewMode === mode ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-[11px] text-neutral-600">
            Orden
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as ListingSort)}
              className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-900"
            >
              <option value="score_desc">Mayor score</option>
              <option value="discount_desc">Mayor descuento</option>
              <option value="roi_desc">Mayor rentabilidad</option>
              <option value="price_asc">Precio ↑</option>
              <option value="price_desc">Precio ↓</option>
              <option value="sqm_desc">m² ↓</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {activeCp && (
            <button
              type="button"
              onClick={onClearCp}
              className="rounded-full bg-neutral-900 px-2.5 py-1 font-medium text-white"
            >
              CP {activeCp} ×
            </button>
          )}
          <span className="font-semibold tabular-nums text-neutral-900">
            {loading ? "…" : matchedCount.toLocaleString("es-ES")}
            {!loading && catalogTotal > matchedCount && (
              <span className="font-normal text-neutral-500"> / {catalogTotal}</span>
            )}{" "}
            oportunidades
          </span>
          {zoneCpNote && (
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-neutral-700">
              {zoneCpNote}
            </span>
          )}
          {zoneImporting && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-medium text-amber-950">
              Importando portales en la zona…
            </span>
          )}
          {onRefreshZone && (
            <button
              type="button"
              onClick={onRefreshZone}
              className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Scrape profundo
            </button>
          )}
          <button type="button" onClick={onReset} className="text-neutral-500 underline hover:text-neutral-800">
            Limpiar filtros
          </button>
          {activeCp && (
            <Link
              href={explorarHrefFromFilters(filters, { cp: activeCp })}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 font-medium text-neutral-800 hover:bg-neutral-50"
            >
              Mapa explorar
            </Link>
          )}
          {activeCp && (
            <button
              type="button"
              onClick={() => {
                saveZoneWatch({
                  postalCode: activeCp,
                  label: zoneLabel,
                  filters,
                });
                setWatchSaved(true);
                window.setTimeout(() => setWatchSaved(false), 2500);
              }}
              className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 font-medium text-violet-950 hover:bg-violet-100"
            >
              {watchSaved ? "Zona guardada" : "Guardar zona"}
            </button>
          )}
          <Link
            href={scanNuevoHrefFromFilters(filters, { cp: activeCp, notifyEmail: true })}
            className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 font-medium text-orange-950 hover:bg-orange-100"
          >
            Crear alerta
          </Link>
        </div>
      </div>

      {advancedOpen && (
        <div className="border-t border-neutral-100 bg-neutral-50/80 px-4 py-3 lg:px-6">
          <AdvancedFiltersRow filters={filters} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

function AdvancedFiltersRow({
  filters,
  onChange,
}: {
  filters: ScanRunFilters;
  onChange: (next: ScanRunFilters) => void;
}) {
  const allowed = new Set(filters.allowedBedrooms ?? []);
  const plus4 = filters.bedroomsMinPlus === 4;

  return (
    <div className="flex flex-wrap items-end gap-4 text-[11px]">
      <div>
        <p className="mb-1 font-medium text-neutral-600">Habitaciones</p>
        <div className="flex flex-wrap gap-1">
          {(
            [
              [0, "Estudio"],
              [1, "1"],
              [2, "2"],
              [3, "3"],
              [4, "4+"],
            ] as const
          ).map(([n, label]) => {
            const on = n === 4 ? plus4 : allowed.has(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  if (n === 4) {
                    onChange({ ...filters, bedroomsMinPlus: plus4 ? null : 4 });
                    return;
                  }
                  const set = new Set(filters.allowedBedrooms ?? []);
                  if (on) set.delete(n);
                  else set.add(n);
                  onChange({ ...filters, allowedBedrooms: [...set].sort((a, b) => a - b) });
                }}
                className={`rounded-full border px-2 py-0.5 ${
                  on ? "border-neutral-800 bg-neutral-800 text-white" : "border-neutral-200 bg-white"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="text-neutral-600">
        m² mín.
        <input
          type="number"
          className="mt-0.5 block w-20 rounded border border-neutral-200 px-2 py-1"
          value={filters.sqmMin ?? 0}
          onChange={(e) => onChange({ ...filters, sqmMin: Number(e.target.value) || 0 })}
        />
      </label>
      <label className="text-neutral-600">
        m² máx.
        <input
          type="number"
          className="mt-0.5 block w-20 rounded border border-neutral-200 px-2 py-1"
          value={filters.sqmMax ?? 500}
          onChange={(e) => onChange({ ...filters, sqmMax: Number(e.target.value) || 500 })}
        />
      </label>
      <label className="text-neutral-600">
        Precio mín. €
        <input
          type="number"
          className="mt-0.5 block w-28 rounded border border-neutral-200 px-2 py-1"
          value={filters.priceMin ?? 0}
          onChange={(e) => onChange({ ...filters, priceMin: Number(e.target.value) || 0 })}
        />
      </label>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 font-medium text-orange-900"
          onClick={() =>
            onChange({ ...filters, minDiscountPct: 12, minOpportunityScore: 58, maxScrapedAgeDays: 30 })
          }
        >
          Chollos radar
        </button>
        <button
          type="button"
          className="rounded-full border border-neutral-200 bg-white px-2.5 py-1"
          onClick={() => onChange({ ...filters, minRoiGross: 8, onlyWithRoi: true })}
        >
          ROI ≥ 8 %
        </button>
        <button
          type="button"
          className="rounded-full border border-neutral-200 bg-white px-2.5 py-1"
          onClick={() => onChange({ ...filters, priceMax: 200_000, priceMin: 0 })}
        >
          ≤ 200 k€
        </button>
      </div>
    </div>
  );
}
