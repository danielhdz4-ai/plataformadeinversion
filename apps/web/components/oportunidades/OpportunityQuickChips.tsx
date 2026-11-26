"use client";

import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";

type Props = {
  filters: ScanRunFilters;
  onChange: (next: ScanRunFilters) => void;
};

const CHIPS: {
  label: string;
  apply: (f: ScanRunFilters) => ScanRunFilters;
  isActive: (f: ScanRunFilters) => boolean;
}[] = [
  {
    label: "Mejores chollos",
    apply: (f) => ({ ...f, minDiscountPct: 12, minOpportunityScore: 65, maxScrapedAgeDays: 30 }),
    isActive: (f) => (f.minDiscountPct ?? 0) >= 12 && (f.minOpportunityScore ?? 0) >= 65,
  },
  {
    label: "Chollos −20 % o más",
    apply: (f) => ({ ...f, minDiscountPct: 20, minOpportunityScore: 0, maxScrapedAgeDays: 0 }),
    isActive: (f) => (f.minDiscountPct ?? 0) >= 20 && (f.minOpportunityScore ?? 0) === 0,
  },
  {
    label: "≤ 60.000 €",
    apply: (f) => ({ ...f, priceMax: 60_000, priceMin: 0 }),
    isActive: (f) => (f.priceMax ?? 0) <= 60_000,
  },
  {
    label: "≤ 80k · ROI 6,5 %",
    apply: (f) => ({
      ...f,
      priceMax: 80_000,
      priceMin: 0,
      minRoiGross: 6.5,
      onlyWithRoi: true,
    }),
    isActive: (f) =>
      (f.priceMax ?? 0) <= 80_000 && (f.minRoiGross ?? 0) >= 6.5 && f.onlyWithRoi === true,
  },
  {
    label: "ROI ≥ 8 %",
    apply: (f) => ({ ...f, minRoiGross: 8, onlyWithRoi: true }),
    isActive: (f) => (f.minRoiGross ?? 0) >= 8 && f.onlyWithRoi === true,
  },
  {
    label: "Mayor score",
    apply: (f) => ({ ...f, minOpportunityScore: 70, minDiscountPct: 0 }),
    isActive: (f) => (f.minOpportunityScore ?? 0) >= 70,
  },
  {
    label: "Bancos y subastas",
    apply: (f) => ({ ...f, sellerKinds: ["bank", "auction"] }),
    isActive: (f) =>
      f.sellerKinds?.includes("bank") === true && f.sellerKinds?.includes("auction") === true,
  },
];

export function OpportunityQuickChips({ filters, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-neutral-100 bg-white px-4 py-2 lg:px-8">
      {CHIPS.map((chip) => {
        const active = chip.isActive(filters);
        return (
          <button
            key={chip.label}
            type="button"
            onClick={() => onChange(chip.apply({ ...filters }))}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
              active
                ? "bg-neutral-900 text-white"
                : "border border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 hover:bg-white"
            }`}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
