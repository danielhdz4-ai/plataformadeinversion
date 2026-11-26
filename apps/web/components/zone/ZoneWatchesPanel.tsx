"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { filtersToUrlSearchParams } from "@/lib/filters/url-sync";
import { listZoneWatches, removeZoneWatch, type ZoneWatch } from "@/lib/zone/zone-watches.client";

export function ZoneWatchesPanel() {
  const [watches, setWatches] = useState<ZoneWatch[]>([]);

  useEffect(() => {
    setWatches(listZoneWatches());
  }, []);

  if (watches.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-violet-200/80 bg-violet-50/40 p-4">
      <h2 className="text-sm font-semibold text-violet-950">Zonas vigiladas (este navegador)</h2>
      <p className="mt-1 text-xs text-violet-900/80">
        Atajos a Oportunidades y Explorar con los filtros que guardaste.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {watches.map((w) => {
          const fp = filtersToUrlSearchParams(w.filters);
          fp.set("cp", w.postalCode);
          const opp = `/app/oportunidades?${fp.toString()}`;
          const exp = `/app/explorar?cp=${w.postalCode}`;
          return (
            <li
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2 text-xs"
            >
              <div>
                <span className="font-semibold text-neutral-900">CP {w.postalCode}</span>
                {w.label && (
                  <span className="ml-2 text-neutral-500">{w.label.replace(/\b\d{5}\b/, "").trim()}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={opp} className="font-medium text-orange-800 underline">
                  Oportunidades
                </Link>
                <Link href={exp} className="font-medium text-neutral-700 underline">
                  Mapa
                </Link>
                <button
                  type="button"
                  className="text-neutral-400 hover:text-red-600"
                  onClick={() => {
                    removeZoneWatch(w.id);
                    setWatches(listZoneWatches());
                  }}
                >
                  Quitar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}