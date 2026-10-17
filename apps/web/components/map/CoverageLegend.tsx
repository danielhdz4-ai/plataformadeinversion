"use client";

import { useEffect, useState } from "react";

type Region = {
  slug: string;
  name: string;
  tier: number;
  last_scrape_at: string | null;
  sale_count?: number;
  rent_count?: number;
};

export function CoverageLegend({ className = "" }: { className?: string }) {
  const [regions, setRegions] = useState<Region[]>([]);

  useEffect(() => {
    fetch("/api/map/coverage")
      .then((r) => r.json())
      .then((d) => setRegions((d.regions ?? []) as Region[]))
      .catch(() => setRegions([]));
  }, []);

  if (regions.length === 0) return null;

  const sorted = [...regions].sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <div
      className={`rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-[11px] text-neutral-700 shadow-sm backdrop-blur ${className}`}
    >
      <p className="font-semibold text-neutral-900">Zonas con datos</p>
      <ul className="mt-1 flex max-w-md flex-wrap gap-1.5">
        {sorted.map((r) => (
          <li
            key={r.slug}
            className={`rounded-full border px-2 py-0.5 ${
              r.tier === 1
                ? "border-neutral-950 bg-neutral-950 text-white"
                : "border-neutral-200 bg-[#f7f6f3] text-neutral-800"
            }`}
            title={
              r.last_scrape_at
                ? `Tier ${r.tier ?? 2} · ${r.sale_count ?? "?"} ventas · ${new Date(r.last_scrape_at).toLocaleString("es-ES")}`
                : `Tier ${r.tier ?? 2} · ${r.sale_count ?? "?"} ventas · sin scrape reciente`
            }
          >
            {r.name}
            {r.sale_count != null && r.sale_count > 0 ? ` (${r.sale_count})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
