"use client";

import { useEffect, useState } from "react";

type Stats = {
  listings: { saleActive: number; rentActive: number; saleByPortal?: Record<string, number> };
  scrapeRuns: { source: string; status: string; started_at: string; listings_inserted: number | null }[];
};

export function PlatformStatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    fetch("/api/platform/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const last = stats?.scrapeRuns?.[0];
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-neutral-800 px-4 py-2 text-[11px] text-neutral-400 md:px-6 md:text-xs">
      <span>
        Inventario activo:{" "}
        <strong className="text-white">{stats?.listings.saleActive ?? "—"}</strong> venta ·{" "}
        <strong className="text-white">{stats?.listings.rentActive ?? "—"}</strong> alquiler
      </span>
      <span className="text-neutral-600">|</span>
      <span>
        Último scrape:{" "}
        {last
          ? `${last.source} (${last.status}${last.listings_inserted === 0 ? " · 0 nuevos" : ""})`
          : "sin runs"}
      </span>
      <span className="hidden text-neutral-600 md:inline">|</span>
      <span className="hidden md:inline">
        kelify {stats?.listings.saleByPortal?.kelify ?? 0} · pisos{" "}
        {(stats?.listings.saleByPortal?.pisos_com ??
          stats?.listings.saleByPortal?.["pisos.com"] ??
          stats?.listings.saleByPortal?.pisos ??
          0) as number}
      </span>
    </div>
  );
}
