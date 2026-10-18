import { decodeListingTitle } from "@/lib/decode-html";
import type { RoomRentComparable } from "@/lib/listing/room-rent";

function proxiedThumb(url: string | null | undefined) {
  if (!url) return null;
  if (url.includes("pisos.com") || url.includes("kelify.com")) {
    return `/api/image-proxy?u=${encodeURIComponent(url)}`;
  }
  return url;
}

function fmt(n: number) {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

export function RoomRentComparablesPanel({
  comparables,
  estimatePerRoom,
  conservativePerRoom,
  bedrooms,
  radiusM = 2500,
}: {
  comparables: RoomRentComparable[];
  estimatePerRoom: number | null;
  conservativePerRoom: number | null;
  bedrooms: number | null;
  radiusM?: number;
}) {
  const nRooms = Math.max(1, bedrooms ?? 2);
  const totalEst =
    estimatePerRoom != null ? estimatePerRoom * nRooms : null;
  const totalCons =
    conservativePerRoom != null ? conservativePerRoom * nRooms : null;

  return (
    <section className="rounded-xl border border-neutral-200 bg-neutral-950 p-3 text-white shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            Habitaciones en alquiler
          </h4>
          <p className="mt-0.5 text-[10px] text-neutral-500">
            Radio ~{Math.round(radiusM / 100) / 10} km · {comparables.length} comparables
          </p>
        </div>
        {conservativePerRoom != null && (
          <div className="text-right">
            <p className="text-[9px] uppercase text-neutral-500">Estimación conservadora</p>
            <p className="text-lg font-bold tabular-nums">{fmt(conservativePerRoom)} €/mes</p>
            {totalCons != null && (
              <p className="text-[10px] text-neutral-400">
                × {nRooms} hab. ≈ {fmt(totalCons)} €/mes
              </p>
            )}
          </div>
        )}
      </div>

      {estimatePerRoom != null && (
        <p className="mt-2 text-xs text-neutral-300">
          Mediana habitación: <span className="font-semibold text-white">{fmt(estimatePerRoom)} €/mes</span>
          {totalEst != null && (
            <>
              {" "}
              · piso completo estimado{" "}
              <span className="font-semibold text-emerald-400">{fmt(totalEst)} €/mes</span>
            </>
          )}
        </p>
      )}

      {comparables.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-500">
          No hay habitaciones en alquiler en el radio. Amplía zona o revisa scrape de alquileres.
        </p>
      ) : (
        <ul className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {comparables.map((c) => {
            const img = proxiedThumb(c.thumbnailUrl);
            const title = decodeListingTitle(c.title ?? "Habitación");
            const specs = [
              c.sqm != null ? `${c.sqm} m²` : null,
              c.bedrooms != null ? `${c.bedrooms} bd` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li
                key={c.id}
                className="flex gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900/80 p-2"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-neutral-800">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[9px] text-neutral-600">
                      —
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[11px] font-medium leading-snug text-neutral-100">
                    {title}
                  </p>
                  {specs && <p className="mt-0.5 text-[10px] text-neutral-500">{specs}</p>}
                  <div className="mt-1 flex items-end justify-between gap-2">
                    <span className="text-base font-bold tabular-nums text-white">
                      {fmt(c.price)} €/mes
                    </span>
                    <span className="text-[10px] text-neutral-500">a {Math.round(c.distanceM)} m</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
