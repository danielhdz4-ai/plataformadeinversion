"use client";

import dynamic from "next/dynamic";

export const RoiScanMap = dynamic(
  () => import("./RoiScanMap").then((m) => m.RoiScanMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
        Cargando mapa…
      </div>
    ),
  }
);
