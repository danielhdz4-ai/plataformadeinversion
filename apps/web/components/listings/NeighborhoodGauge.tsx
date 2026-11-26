/** Comparación €/m² inmueble vs media CP (marca sobre barra). */
export function NeighborhoodGauge({
  listingM2,
  cpAvgM2,
  vsPct,
}: {
  listingM2: number;
  cpAvgM2: number;
  vsPct: number | null;
}) {
  const min = Math.min(listingM2, cpAvgM2) * 0.85;
  const max = Math.max(listingM2, cpAvgM2) * 1.15;
  const span = max - min || 1;
  const listingPct = ((listingM2 - min) / span) * 100;
  const cpPct = ((cpAvgM2 - min) / span) * 100;
  return (
    <div className="space-y-3">
      <div className="relative h-2 rounded-full bg-line">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-lime/25"
          style={{ width: `${cpPct}%` }}
        />
        <div
          className="absolute top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-ink"
          style={{ left: `calc(${listingPct}% - 1.5px)` }}
          title="Este inmueble"
        />
        <div
          className="absolute top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-mint"
          style={{ left: `calc(${cpPct}% - 1.5px)` }}
          title="Media CP"
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="text-ink-muted">Esta propiedad</span>
        <span className="text-ink-muted">Media del CP</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-ink" />
          <span className="text-[15px] font-extrabold tabular-nums text-ink">
            {Math.round(listingM2).toLocaleString("es-ES")}
            <span className="ml-0.5 text-[10px] font-semibold text-ink-muted">€/m²</span>
          </span>
          {vsPct != null && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                vsPct > 0 ? "bg-clay/15 text-clay" : "bg-lime/15 text-lime"
              }`}
            >
              {vsPct > 0 ? "+" : ""}
              {vsPct.toFixed(1)} %
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-mint" />
          <span className="text-[15px] font-extrabold tabular-nums text-ink">
            {Math.round(cpAvgM2).toLocaleString("es-ES")}
            <span className="ml-0.5 text-[10px] font-semibold text-ink-muted">€/m²</span>
          </span>
        </span>
      </div>
    </div>
  );
}
