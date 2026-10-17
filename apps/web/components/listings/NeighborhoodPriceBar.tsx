export function NeighborhoodPriceBar({
  listingM2,
  cpAvgM2,
  vsPct,
}: {
  listingM2: number;
  cpAvgM2: number;
  vsPct: number | null;
}) {
  const max = Math.max(listingM2, cpAvgM2) * 1.15;
  const wListing = (listingM2 / max) * 100;
  const wCp = (cpAvgM2 / max) * 100;
  return (
    <div className="space-y-2">
      <div>
        <div className="mb-1 flex justify-between text-[10px] text-neutral-600">
          <span>Este inmueble</span>
          <span className="font-semibold text-neutral-950">{Math.round(listingM2).toLocaleString("es-ES")} €/m²</span>
        </div>
        <div className="h-2 rounded-full bg-neutral-200">
          <div className="h-2 rounded-full bg-neutral-950" style={{ width: `${wListing}%` }} />
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[10px] text-neutral-600">
          <span>Media CP</span>
          <span>
            {Math.round(cpAvgM2).toLocaleString("es-ES")} €/m²
            {vsPct != null && (
              <span className={vsPct > 0 ? " text-red-600" : " text-emerald-700"}>
                {" "}
                ({vsPct > 0 ? "+" : ""}
                {vsPct.toFixed(1)} %)
              </span>
            )}
          </span>
        </div>
        <div className="h-2 rounded-full bg-neutral-200">
          <div className="h-2 rounded-full bg-neutral-500" style={{ width: `${wCp}%` }} />
        </div>
      </div>
    </div>
  );
}
