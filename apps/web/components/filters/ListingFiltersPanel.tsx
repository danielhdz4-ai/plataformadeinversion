"use client";

import { RangeField } from "@/components/ui/RangeField";
import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";
import { SCAN_PORTALS } from "@/lib/scan/portal-options";
import { portalBadge } from "@/lib/portals";
import { ALL_SELLER_KINDS } from "@/lib/listing/filter-opportunity";
import { SELLER_KIND_LABEL, type SellerKind } from "@/lib/listing/seller-kind";

export type ListingSort =
  | "roi_desc"
  | "price_asc"
  | "price_desc"
  | "sqm_desc"
  | "score_desc"
  | "discount_desc";

type Props = {
  filters: ScanRunFilters;
  onChange: (next: ScanRunFilters) => void;
  sort: ListingSort;
  onSortChange: (s: ListingSort) => void;
  showRoi?: boolean;
  matchedCount: number;
  totalCount: number;
  onReset?: () => void;
  compact?: boolean;
};

function toggleInList(list: number[] | undefined, n: number, on: boolean): number[] {
  const set = new Set(list ?? []);
  if (on) set.add(n);
  else set.delete(n);
  return [...set].sort((a, b) => a - b);
}

export function ListingFiltersPanel({
  filters,
  onChange,
  sort,
  onSortChange,
  showRoi = true,
  matchedCount,
  totalCount,
  onReset,
  compact = false,
}: Props) {
  const allowed = new Set(filters.allowedBedrooms ?? []);
  const plus4 = filters.bedroomsMinPlus === 4;
  const baths = new Set(filters.allowedBathrooms ?? []);
  const bathPlus4 = filters.bathroomsMinPlus === 4;
  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-neutral-800">
          Filtros{" "}
          <span className="tabular-nums text-neutral-500">
            {matchedCount === totalCount ? matchedCount : `${matchedCount} / ${totalCount}`}
          </span>
        </p>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-neutral-500">Orden</label>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as ListingSort)}
            className="rounded border border-neutral-200 px-2 py-0.5 text-[11px]"
          >
            <option value="score_desc">Mayor score</option>
            <option value="discount_desc">Mayor descuento</option>
            {showRoi && <option value="roi_desc">ROI ↓</option>}
            <option value="price_asc">Precio ↑</option>
            <option value="price_desc">Precio ↓</option>
            <option value="sqm_desc">m² ↓</option>
          </select>
          {onReset && (
            <button type="button" onClick={onReset} className="text-[11px] text-neutral-600 underline">
              Restablecer
            </button>
          )}
        </div>
      </div>

      {!compact && (
        <>
          <RangeField
            label="Precio máx."
            value={filters.priceMax ?? 2_000_000}
            min={30_000}
            max={2_000_000}
            step={10_000}
            suffix=" €"
            onChange={(v) => onChange({ ...filters, priceMin: filters.priceMin ?? 0, priceMax: v })}
          />
          <RangeField
            label="Precio mín."
            value={filters.priceMin ?? 0}
            min={0}
            max={Math.min(2_000_000, filters.priceMax ?? 2_000_000)}
            step={10_000}
            suffix=" €"
            onChange={(v) => onChange({ ...filters, priceMin: v })}
          />
        </>
      )}

      {compact && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-neutral-600">
            Precio mín. €
            <input
              type="number"
              className="mt-0.5 w-full rounded border border-neutral-200 px-2 py-1 text-xs"
              value={filters.priceMin ?? 0}
              onChange={(e) => onChange({ ...filters, priceMin: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="text-[11px] text-neutral-600">
            Precio máx. €
            <input
              type="number"
              className="mt-0.5 w-full rounded border border-neutral-200 px-2 py-1 text-xs"
              value={filters.priceMax ?? 2_000_000}
              onChange={(e) =>
                onChange({ ...filters, priceMax: Number(e.target.value) || 2_000_000 })
              }
            />
          </label>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-neutral-700">Habitaciones</p>
        <div className="flex flex-wrap gap-1.5">
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
                  onChange({
                    ...filters,
                    allowedBedrooms: toggleInList(filters.allowedBedrooms, n, !on),
                  });
                }}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                  on ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <RangeField
          label="m² mín."
          value={filters.sqmMin ?? 0}
          min={0}
          max={300}
          step={5}
          suffix=" m²"
          onChange={(v) => onChange({ ...filters, sqmMin: v })}
        />
        <RangeField
          label="m² máx."
          value={filters.sqmMax ?? 500}
          min={20}
          max={600}
          step={5}
          suffix=" m²"
          onChange={(v) => onChange({ ...filters, sqmMax: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-neutral-600">
          Descuento mín. %
          <input
            type="number"
            min={0}
            max={80}
            step={5}
            className="mt-0.5 w-full rounded border border-neutral-200 px-2 py-1 text-xs"
            value={filters.minDiscountPct ?? 0}
            onChange={(e) =>
              onChange({ ...filters, minDiscountPct: Number(e.target.value) || 0 })
            }
          />
        </label>
        <label className="text-[11px] text-neutral-600">
          Score mín.
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            className="mt-0.5 w-full rounded border border-neutral-200 px-2 py-1 text-xs"
            value={filters.minOpportunityScore ?? 0}
            onChange={(e) =>
              onChange({ ...filters, minOpportunityScore: Number(e.target.value) || 0 })
            }
          />
        </label>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-neutral-700">Vendedor</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_SELLER_KINDS.map((k) => {
            const active = filters.sellerKinds?.includes(k) ?? false;
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  const cur = filters.sellerKinds ?? [];
                  const next = active ? cur.filter((x) => x !== k) : [...cur, k];
                  onChange({ ...filters, sellerKinds: next.length ? next : undefined });
                }}
                className={`rounded-full border px-2.5 py-0.5 text-[10px] ${
                  active ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200"
                }`}
              >
                {SELLER_KIND_LABEL[k as SellerKind]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            [0, "Cualquier antigüedad"],
            [14, "≤ 14 d"],
            [30, "≤ 30 d"],
            [90, "≤ 90 d"],
          ] as const
        ).map(([days, label]) => (
          <button
            key={label}
            type="button"
            onClick={() =>
              onChange({ ...filters, maxScrapedAgeDays: days === 0 ? null : days })
            }
            className={`rounded-full border px-2.5 py-0.5 text-[10px] ${
              (filters.maxScrapedAgeDays ?? 0) === days ||
              (days === 0 && (filters.maxScrapedAgeDays == null || filters.maxScrapedAgeDays === 0))
                ? "border-neutral-950 bg-neutral-950 text-white"
                : "border-neutral-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showRoi && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <RangeField
              label="ROI bruto mín."
              value={filters.minRoiGross ?? 0}
              min={0}
              max={15}
              step={0.5}
              suffix=" %"
              onChange={(v) => onChange({ ...filters, minRoiGross: v })}
            />
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-neutral-700">
              <input
                type="checkbox"
                checked={filters.onlyWithRoi === true}
                onChange={(e) => onChange({ ...filters, onlyWithRoi: e.target.checked })}
                className="accent-neutral-950"
              />
              Solo con ROI
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["", "Cualquier conf."],
                ["medium", "Conf. media+"],
                ["high", "Solo alta"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={label}
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    rentConfidenceMin: val === "" ? null : val,
                  })
                }
                className={`rounded-full border px-2.5 py-0.5 text-[10px] ${
                  (filters.rentConfidenceMin ?? "") === val
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] hover:bg-neutral-50"
              onClick={() =>
                onChange({ ...filters, priceMax: 200_000, minRoiGross: 0, rentConfidenceMin: null })
              }
            >
              ≤ 200 k€
            </button>
            <button
              type="button"
              className="rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] hover:bg-neutral-50"
              onClick={() => onChange({ ...filters, minRoiGross: 6, onlyWithRoi: true })}
            >
              ROI ≥ 6 %
            </button>
            <button
              type="button"
              className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] text-orange-950 hover:bg-orange-100"
              onClick={() =>
                onChange({ ...filters, minDiscountPct: 15, minOpportunityScore: 60, maxScrapedAgeDays: 30 })
              }
            >
              Chollos tipo radar
            </button>
            <button
              type="button"
              className="rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] hover:bg-neutral-50"
              onClick={() =>
                onChange({ ...filters, priceMin: 80_000, priceMax: 350_000, sqmMin: 45 })
              }
            >
              Familiar 80–350 k
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-neutral-700">Portales</p>
        <div className="flex flex-wrap gap-1.5">
          {SCAN_PORTALS.map((p) => {
            const allIds = SCAN_PORTALS.map((x) => x.id);
            const activeList = filters.sourcePortals?.length ? filters.sourcePortals : allIds;
            const active = activeList.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  let next = active
                    ? activeList.filter((id) => id !== p.id)
                    : [...activeList, p.id];
                  if (next.length === 0) next = allIds;
                  onChange({ ...filters, sourcePortals: next });
                }}
                className={`rounded-full border px-2 py-0.5 text-[10px] ${
                  active ? "border-violet-300 bg-violet-50 text-violet-900" : "border-neutral-200 opacity-50"
                }`}
              >
                {portalBadge(p.id).name}
              </button>
            );
          })}
        </div>
      </div>

      <details className="text-[11px] text-neutral-600">
        <summary className="cursor-pointer font-medium text-neutral-700">Baños</summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {([1, 2, 3, 4] as const).map((n) => {
            const on = n === 4 ? bathPlus4 : baths.has(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  if (n === 4) {
                    onChange({ ...filters, bathroomsMinPlus: bathPlus4 ? null : 4 });
                    return;
                  }
                  onChange({
                    ...filters,
                    allowedBathrooms: toggleInList(filters.allowedBathrooms, n, !on),
                  });
                }}
                className={`rounded-full border px-2.5 py-0.5 ${
                  on ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200"
                }`}
              >
                {n === 4 ? "4+" : n}
              </button>
            );
          })}
        </div>
      </details>
    </div>
  );
}
