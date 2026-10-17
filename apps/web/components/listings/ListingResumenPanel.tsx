import { ListingAiAnalysisBlock } from "@/components/listings/ListingAiAnalysisBlock";

import { NeighborhoodPriceBar } from "@/components/listings/NeighborhoodPriceBar";

import { PriceTrendSparkline } from "@/components/listings/PriceTrendSparkline";

import { NotariadoPortalPanel } from "@/components/notariado/NotariadoPortalPanel";

import type { ListingSummary } from "@/lib/listing/summary-types";

import Link from "next/link";



function fmt(n: number, d = 0) {

  return n.toLocaleString("es-ES", { maximumFractionDigits: d });

}



export function ListingResumenPanel({

  summary,

  listingId,

  embedded = false,

  showAi = true,

}: {

  summary: ListingSummary;

  listingId: string;

  /** Tarjeta premium: sin borde superior duplicado */

  embedded?: boolean;

  showAi?: boolean;

}) {

  const { roi, comparables, notary, neighborhood, officialMarket, priceEvolution, postalCode } =
    summary;

  const saleLast = priceEvolution.saleM2[priceEvolution.saleM2.length - 1]?.y;

  const rentLast = priceEvolution.rentM2[priceEvolution.rentM2.length - 1]?.y;

  const priceTrendLabel = postalCode
    ? `CP ${postalCode} (indicativo, notariado)`
    : "Mercado local (indicativo)";



  return (

    <div

      className={`space-y-3 bg-[#faf9f7] px-3 py-3 text-xs text-neutral-800 ${

        embedded ? "" : "border-t border-neutral-100"

      }`}

    >

      <div className="flex items-center justify-between">

        <span className="rounded bg-neutral-950 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">

          Resumen inversión

        </span>

        {!embedded && (

          <Link href={`/app/listings/${listingId}`} className="font-medium text-neutral-950 underline">

            Ficha completa

          </Link>

        )}

      </div>



      {showAi && !embedded && (

        <ListingAiAnalysisBlock listingId={listingId} compact />

      )}



      <section className="rounded-lg border border-neutral-200 bg-white p-2.5">

        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">

          Estimación de ROI

        </h4>

        <dl className="mt-1.5 space-y-1">

          <Row label="Alquiler estimado" value={roi.rentEstMonthly != null ? `${fmt(roi.rentEstMonthly)} €/mes` : "—"} />

          <Row label="Precio de compra" value={`${fmt(roi.purchasePrice)} €`} />

          <Row label={`Impuestos compra (${roi.purchaseTaxPct} %)`} value={`${fmt(roi.purchaseTaxAmount)} €`} />

          <Row label="Efectivo total invertido" value={`${fmt(roi.totalCashInvested)} €`} strong />

          <Row

            label="ROI bruto"

            value={roi.grossRoiPct != null ? `${roi.grossRoiPct.toFixed(2)} %` : "—"}

            strong

          />

          {roi.rentConfidence && (

            <p className="text-[10px] text-neutral-500">

              Confianza renta: {roi.rentConfidence} · {roi.comparablesCount} comparables en modelo

            </p>

          )}

        </dl>

        <Link href="/app/calculator" className="mt-2 inline-block text-[10px] font-medium underline">

          Calculadora ROI completa (hipoteca, IBI, cash-on-cash, flip, Airbnb)

        </Link>

      </section>



      <section className="rounded-lg border border-neutral-200 bg-white p-2.5">

        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">

          Evolución de precios — {priceTrendLabel}

        </h4>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">

          <div>

            <div className="mb-1 flex items-baseline justify-between gap-1">

              <span className="font-medium text-neutral-800">Venta €/m²</span>

              <span className="tabular-nums text-neutral-950">

                {saleLast != null ? `${Math.round(saleLast).toLocaleString("es-ES")} €` : "—"}

                <span className="ml-1 text-emerald-700">+{priceEvolution.saleChangePct.toFixed(1)}%</span>

              </span>

            </div>

            <PriceTrendSparkline points={priceEvolution.saleM2} />

            <p className="mt-0.5 text-[9px] text-neutral-500">

              {priceEvolution.saleM2.map((p) => p.x).join(" · ")}

            </p>

          </div>

          <div>

            <div className="mb-1 flex items-baseline justify-between gap-1">

              <span className="font-medium text-neutral-800">Alquiler €/m²/mes</span>

              <span className="tabular-nums text-neutral-950">

                {rentLast != null ? `${rentLast.toFixed(1)} €` : "—"}

                <span className="ml-1 text-emerald-700">+{priceEvolution.rentChangePct.toFixed(1)}%</span>

              </span>

            </div>

            <PriceTrendSparkline points={priceEvolution.rentM2} stroke="#525252" />

          </div>

        </div>

      </section>



      {neighborhood.listingPriceM2 != null && neighborhood.cpAvgPriceM2 != null && (

        <section className="rounded-lg border border-neutral-200 bg-white p-2.5">

          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">

            Resumen del barrio (€/m²)

          </h4>

          <div className="mt-2">

            <NeighborhoodPriceBar

              listingM2={neighborhood.listingPriceM2}

              cpAvgM2={neighborhood.cpAvgPriceM2}

              vsPct={neighborhood.vsCpPct}

            />

          </div>

        </section>

      )}



      <section className="rounded-lg border border-neutral-200 bg-white p-2.5">

        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">

          Comparables de alquiler (500 m)

        </h4>

        {comparables.length === 0 ? (

          <p className="mt-1 text-neutral-500">Sin alquileres activos en radio — usa renta estimada del modelo.</p>

        ) : (

          <ul className="mt-1.5 space-y-2">

            {comparables.map((c) => (

              <li key={c.id} className="flex justify-between gap-2 rounded border border-neutral-100 bg-[#faf9f7] p-2">

                <span className="line-clamp-1 flex-1">{c.title ?? "Alquiler"}</span>

                <span className="shrink-0 tabular-nums font-medium">

                  {fmt(c.price)} €/mes · {Math.round(c.distanceM)} m

                </span>

              </li>

            ))}

          </ul>

        )}

      </section>



      {notary?.portal ? (
        <NotariadoPortalPanel portal={notary.portal} />
      ) : (
        notary && (
          <section className="rounded-lg border border-neutral-200 bg-white p-2.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Mercado inmobiliario — CP {summary.postalCode}
            </h4>
            <dl className="mt-1.5 grid gap-1 sm:grid-cols-2">
              <Row label="Precio medio / m²" value={notary.priceM2 != null ? `${fmt(notary.priceM2)} €` : "—"} />
              <Row label="Precio medio venta" value={notary.avgPrice != null ? `${fmt(notary.avgPrice)} €` : "—"} />
              <Row label="Superficie media" value={notary.avgSurface != null ? `${fmt(notary.avgSurface)} m²` : "—"} />
              <Row
                label="Compraventas"
                value={notary.operationsCount != null ? String(notary.operationsCount) : "—"}
              />
            </dl>
            {notary.period && (
              <p className="mt-1 text-[10px] text-neutral-500">
                Periodo {notary.period} · Notariado{notary.esEstimado ? " (est.)" : ""}
              </p>
            )}
          </section>
        )
      )}



      {officialMarket.length > 0 && (

        <section className="rounded-lg border border-neutral-200 bg-white p-2.5">

          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">

            Índices oficiales (provincia)

          </h4>

          <ul className="mt-1 space-y-1.5 text-[10px] text-neutral-600">

            {officialMarket.map((o) => {

              const m = o.metrics as Record<string, unknown>;

              const idx = m.priceIndexLibre ?? (m.barcelonaLibre as { priceIndex?: number } | undefined)?.priceIndex;

              return (

                <li key={`${o.source}-${o.period}`} className="rounded border border-neutral-100 bg-[#faf9f7] p-2">

                  <span className="font-medium text-neutral-800">{o.source}</span> · {o.period}

                  {idx != null && (

                    <div className="mt-0.5 tabular-nums font-medium text-neutral-950">

                      Índice vivienda libre (MIVAU): {Number(idx).toLocaleString("es-ES")}

                    </div>

                  )}

                </li>

              );

            })}

          </ul>

        </section>

      )}



      <section className="rounded-lg border border-neutral-200 bg-white p-2.5">

        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">

          Datos demográficos

        </h4>

        <p className="mt-1 text-neutral-600">{summary.demographics.note}</p>

      </section>



      <section className="rounded-lg border border-neutral-200 bg-white p-2.5">

        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">

          Desarrollos locales (referencia)

        </h4>

        <ul className="mt-1.5 space-y-2">

          {summary.localDevelopments.map((d) => (

            <li key={d.title} className="rounded border border-neutral-100 bg-[#faf9f7] p-2">

              <p className="font-medium text-neutral-950">{d.title}</p>

              <p className="text-[10px] text-neutral-500">

                {d.category} · {d.year}

              </p>

              <p className="mt-0.5 text-neutral-600">{d.description}</p>

            </li>

          ))}

        </ul>

      </section>



      <section className="rounded-lg border border-neutral-200 bg-white p-2.5">

        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">

          Lugares cercanos

        </h4>

        <p className="mt-1 text-neutral-600">{summary.nearbyPlaces.note}</p>

      </section>

    </div>

  );

}



function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {

  return (

    <div className="flex justify-between gap-2">

      <dt className="text-neutral-600">{label}</dt>

      <dd className={strong ? "font-bold text-neutral-950" : "font-medium tabular-nums"}>{value}</dd>

    </div>

  );

}

