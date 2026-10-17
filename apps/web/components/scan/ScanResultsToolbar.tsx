import Link from "next/link";

export function ScanResultsToolbar({
  scanId,
  sort,
  onSortChange,
  onExportCsv,
  onExportJson,
  onRepeat,
  repeating,
}: {
  scanId: string;
  sort: "roi_desc" | "price_asc";
  onSortChange: (s: "roi_desc" | "price_asc") => void;
  onExportCsv: () => void;
  onExportJson?: () => void;
  onRepeat: () => void;
  repeating?: boolean;
}) {
  const btn =
    "rounded-md border border-neutral-300 bg-[#f7f6f3] px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-white";
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2.5">
      <Link href="/app/scan/nuevo" className={btn}>
        + Nuevo Scan
      </Link>
      <button type="button" onClick={onRepeat} disabled={repeating} className={btn}>
        {repeating ? "Repitiendo…" : "Repetir scan"}
      </button>
      <button type="button" onClick={onExportCsv} className={btn}>
        CSV
      </button>
      {onExportJson && (
        <button type="button" onClick={onExportJson} className={btn}>
          JSON
        </button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <label className="text-xs text-neutral-500">Orden</label>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as "roi_desc" | "price_asc")}
          className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs"
        >
          <option value="roi_desc">ROI ↓</option>
          <option value="price_asc">Precio ↑</option>
        </select>
      </div>
      <span className="w-full text-[10px] text-neutral-400">Scan {scanId.slice(0, 8)}…</span>
    </div>
  );
}
