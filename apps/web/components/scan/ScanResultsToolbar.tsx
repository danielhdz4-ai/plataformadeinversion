import Link from "next/link";

export function ScanResultsToolbar({
  scanId,
  sort,
  onSortChange,
  onExportCsv,
  onExportJson,
  onRepeat,
  repeating,
  showRoiSort = true,
  totalCount,
  filteredCount,
  priceMin,
  priceMax,
  priceCeiling,
  onPriceMinChange,
  onPriceMaxChange,
}: {
  scanId: string;
  sort: "roi_desc" | "price_asc" | "price_desc";
  onSortChange: (s: "roi_desc" | "price_asc" | "price_desc") => void;
  showRoiSort?: boolean;
  onExportCsv: () => void;
  onExportJson?: () => void;
  onRepeat: () => void;
  repeating?: boolean;
  totalCount: number;
  filteredCount: number;
  priceMin: number;
  priceMax: number;
  priceCeiling: number;
  onPriceMinChange: (v: number) => void;
  onPriceMaxChange: (v: number) => void;
}) {
  const btn =
    "rounded-md border border-neutral-300 bg-[#f7f6f3] px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-white";
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-neutral-200 bg-white px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/app/scan/nuevo" className={btn}>
          + Nuevo Scan
        </Link>
        <button type="button" onClick={onRepeat} disabled={repeating} className={btn}>
          {repeating ? "Repitiendo…" : "Repetir scan"}
        </button>
        <button type="button" onClick={onExportCsv} className={btn}>
          Exportar CSV
        </button>
        {onExportJson && (
          <button type="button" onClick={onExportJson} className={btn}>
            JSON
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-white tabular-nums">
            {filteredCount === totalCount
              ? `${totalCount} inmuebles`
              : `${filteredCount} / ${totalCount} inmuebles`}
          </span>
          <label className="text-xs text-neutral-500">Orden</label>
          <select
            value={sort}
            onChange={(e) =>
              onSortChange(e.target.value as "roi_desc" | "price_asc" | "price_desc")
            }
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs"
          >
            {showRoiSort && <option value="roi_desc">ROI ↓</option>}
            <option value="price_asc">Precio ↑</option>
            <option value="price_desc">Precio ↓</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <p className="text-xs font-medium text-neutral-700">Filtro precio (resultados)</p>
        <label className="text-[11px] text-neutral-500">
          Mín. €
          <input
            type="number"
            min={0}
            max={priceMax}
            step={5000}
            value={priceMin}
            onChange={(e) => onPriceMinChange(Number(e.target.value) || 0)}
            className="mt-0.5 block w-28 rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-900"
          />
        </label>
        <label className="text-[11px] text-neutral-500">
          Máx. €
          <input
            type="number"
            min={priceMin}
            max={Math.max(priceCeiling, priceMax)}
            step={5000}
            value={priceMax}
            onChange={(e) => onPriceMaxChange(Number(e.target.value) || 0)}
            className="mt-0.5 block w-28 rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-900"
          />
        </label>
        <input
          type="range"
          min={0}
          max={Math.max(50_000, priceCeiling)}
          step={5000}
          value={Math.min(priceMax, priceCeiling)}
          onChange={(e) => onPriceMaxChange(Number(e.target.value))}
          className="h-2 min-w-[120px] flex-1 cursor-pointer accent-neutral-950"
          aria-label="Precio máximo"
        />
      </div>
      <span className="text-[10px] text-neutral-400">Scan {scanId.slice(0, 8)}…</span>
    </div>
  );
}
