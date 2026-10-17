"use client";

import { useEffect, useState } from "react";

type Stats = {
  listings: { saleActive: number; rentActive: number; saleByPortal?: Record<string, number> };
  lastScrape?: {
    source: string;
    status: string;
    started_at: string;
    listings_inserted: number | null;
  } | null;
  scrapeInProgress?: { source: string; status: string } | null;
};

export function PlatformStatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    fetch("/api/platform/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const last = stats?.lastScrape;
  const running = stats?.scrapeInProgress;
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
          ? `${last.source} (${last.status}${last.listings_inserted != null ? ` · ${last.listings_inserted} upserts` : ""})`
          : "sin runs"}
        {running ? ` · en curso: ${running.source}` : ""}
      </span>
      <span className="hidden text-neutral-600 md:inline">|</span>
      <span className="hidden md:inline">
        kelify {stats?.listings.saleByPortal?.kelify ?? 0} · pisos{" "}
        {(stats?.listings.saleByPortal?.pisos_com ??
          stats?.listings.saleByPortal?.["pisos.com"] ??
          stats?.listings.saleByPortal?.pisos ??
          0) as number}{" "}
        · hipoges {stats?.listings.saleByPortal?.hipoges ?? 0} · solvia{" "}
        {stats?.listings.saleByPortal?.solvia ?? 0} · fotocasa{" "}
        {stats?.listings.saleByPortal?.fotocasa ?? 0} · habitaclia{" "}
        {stats?.listings.saleByPortal?.habitaclia ?? 0}
      </span>
    </div>
  );
}
