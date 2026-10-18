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
      <div className="relative h-3 rounded-full bg-neutral-200">
        <div
          className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded bg-neutral-950"
          style={{ left: `calc(${listingPct}% - 1px)` }}
          title="Este inmueble"
        />
        <div
          className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded border border-dashed border-red-500 bg-red-400"
          style={{ left: `calc(${cpPct}% - 1px)` }}
          title="Media CP"
        />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-2 text-[10px]">
        <div>
          <p className="text-neutral-500">Esta propiedad</p>
          <p className="font-semibold tabular-nums text-neutral-950">
            {Math.round(listingM2).toLocaleString("es-ES")} €/m²
            {vsPct != null && (
              <span className={vsPct > 0 ? " text-red-600" : " text-emerald-700"}>
                {" "}
                ({vsPct > 0 ? "+" : ""}
                {vsPct.toFixed(1)} %)
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-neutral-500">Media del código postal</p>
          <p className="font-semibold tabular-nums text-neutral-800">
            {Math.round(cpAvgM2).toLocaleString("es-ES")} €/m²
          </p>
        </div>
      </div>
    </div>
  );
}
