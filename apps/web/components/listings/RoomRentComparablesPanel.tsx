import { MetricCard, MetricSection } from "@/components/ui/MetricCard";
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
  const totalEst = estimatePerRoom != null ? estimatePerRoom * nRooms : null;
  const totalCons = conservativePerRoom != null ? conservativePerRoom * nRooms : null;

  return (
    <MetricSection
      title="Habitaciones en alquiler"
      hint={`Radio ${(radiusM / 1000).toFixed(1)} km · ${comparables.length} comparables · ${nRooms} hab.`}
    >
      <div className="grid grid-cols-2 gap-2 pb-2">
        <MetricCard
          label="Mediana por habitación"
          value={estimatePerRoom != null ? fmt(estimatePerRoom) : "—"}
          unit="€/mes"
          size="sm"
          sub={totalEst != null ? `Piso completo ≈ ${fmt(totalEst)} €/mes` : undefined}
        />
        <MetricCard
          label="Escenario conservador"
          value={conservativePerRoom != null ? fmt(conservativePerRoom) : "—"}
          unit="€/mes"
          size="sm"
          sub={totalCons != null ? `× ${nRooms} hab ≈ ${fmt(totalCons)} €/mes` : undefined}
        />
      </div>

      {comparables.length === 0 ? (
        <p className="py-2 text-[12px] text-ink-muted">
          No hay habitaciones en alquiler en el radio. Amplía zona o revisa el scrape de alquileres.
        </p>
      ) : (
        <ul className="max-h-[420px] space-y-2 overflow-y-auto py-1 pr-1">
          {comparables.map((c) => {
            const img = proxiedThumb(c.thumbnailUrl);
            const title = decodeListingTitle(c.title ?? "Habitación");
            const specs = [c.sqm != null ? `${c.sqm} m²` : null, c.bedrooms != null ? `${c.bedrooms} bd` : null]
              .filter(Boolean)
              .join(" · ");
            return (
              <li
                key={c.id}
                className="flex gap-2.5 rounded-xl border border-line bg-raised/60 p-2 transition hover:border-lime/40"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[9px] text-ink-muted">—</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[11px] font-medium leading-snug text-ink">{title}</p>
                  {specs && <p className="mt-0.5 text-[10px] text-ink-muted">{specs}</p>}
                  <div className="mt-1 flex items-end justify-between gap-2">
                    <span className="text-[15px] font-extrabold tabular-nums text-ink">
                      {fmt(c.price)} <span className="text-[10px] font-semibold text-ink-muted">€/mes</span>
                    </span>
                    <span className="text-[10px] text-ink-muted">a {Math.round(c.distanceM)} m</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </MetricSection>
  );
}
