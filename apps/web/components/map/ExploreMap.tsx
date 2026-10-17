"use client";

import { RoiScanMap } from "./RoiScanMap";

type Pin = { id: string; lng: number; lat: number; roi: number | null; price: number };

/** @deprecated Usa RoiScanMap — evita capa circle verde duplicada */
export function ExploreMap({
  pins,
  onBboxChange,
}: {
  pins: Pin[];
  onBboxChange?: (bbox: [number, number, number, number]) => void;
}) {
  return (
    <RoiScanMap
      pins={pins.map((p) => ({ ...p, rentEst: null }))}
      onBboxChange={onBboxChange}
      className="h-[min(520px,65vh)] w-full rounded-xl border border-neutral-200"
    />
  );
}
