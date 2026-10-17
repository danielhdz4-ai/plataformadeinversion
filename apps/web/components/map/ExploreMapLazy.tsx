"use client";

import dynamic from "next/dynamic";

export const ExploreMap = dynamic(
  () => import("./ExploreMap").then((m) => m.ExploreMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(520px,65vh)] w-full items-center justify-center rounded-xl border border-slate-800 text-sm text-slate-400">
        Cargando mapa…
      </div>
    ),
  }
);
