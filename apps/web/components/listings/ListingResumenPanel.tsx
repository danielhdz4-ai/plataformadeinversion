"use client";

import { ListingAiAnalysisBlock } from "@/components/listings/ListingAiAnalysisBlock";
import { MetricDetailModal } from "@/components/listings/MetricDetailModal";
import { NotariadoPortalPanel } from "@/components/notariado/NotariadoPortalPanel";
import { MetricCard, MetricRow, MetricSection } from "@/components/ui/MetricCard";
import { dealNumbersFromSummary } from "@/lib/listing/deal-numbers";
import type { ListingSummary } from "@/lib/listing/summary-types";

import Link from "next/link";
import { useState } from "react";

type DetailModal = "roi" | "trend" | "neighborhood" | "notary" | "barrio" | "inmueble" | null;

function fmt(n: number, d = 0) {
  return n.toLocaleString("es-ES", { maximumFractionDigits: d });
}

/** Pasos 1..5 de la última serie, para sparkline rápido. */
function tail(points: { x: string; y: number }[], n = 8) {
  return points.slice(Math.max(0, points.length - n));
}

export function ListingResumenPanel({
  summary,
  listingId,
  embedded = false,
  showAi = true,
}: {
  summary: ListingSummary;
  listingId: string;
  /** Tarjeta premium (footer ligero) */
  embedded?: boolean;
  showAi?: boolean;
}) {
  const { roi, comparables, roomRent, notary, neighborhood, officialMarket, priceEvolution, postalCode } =
    summary;
  const deal = dealNumbersFromSummary(summary, roi.purchasePrice);

  const saleLast = priceEvolution.saleM2[priceEvolution.saleM2.length - 1]?.y;
  const rentLast = priceEvolution.rentM2[priceEvolution.rentM2.length - 1]?.y;
  const priceTrendLabel = postalCode
    ? `CP ${postalCode} (indicativo, notariado)`
    : "Mercado local (indicativo)";

  const [detailModal, setDetailModal] = useState<DetailModal>(null);

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
            Inversión y mercado
          </h3>
          {!embedded && (
            <Link
              href={`/app/listings/${listingId}`}
              className="text-xs font-semibold text-lime hover:underline"
            >
              Ficha completa →
            </Link>
          )}
        </div>

        {showAi && !embedded && <ListingAiAnalysisBlock listingId={listingId} compact />}

        {/* ── Cifras de cabecera: mismo formato para todo ── */}
        <div className="grid grid-cols-2 gap-2.5">
          <MetricCard
            label="Renta estimada"
            value={roomRent?.totalEstimateMonthly != null ? fmt(roomRent.totalEstimateMonthly) : roi.rentEstMonthly != null ? fmt(roi.rentEstMonthly) : "—"}
            unit="€/mes"
            size="lg"
            sub={
              roi.rentConfidence
                ? `Confianza ${roi.rentConfidence === "high" ? "alta" : roi.rentConfidence === "medium" ? "media" : "baja"}`
                : null
            }
            note={`${roi.comparablesCount} comparables · ${roomRent ? "habitaciones" : "piso entero"}`}
            onOpen={() => setDetailModal("roi")}
          />
          <MetricCard
            label="ROI bruto"
            value={roi.grossRoiPct != null ? roi.grossRoiPct.toFixed(2) : "—"}
            unit="%"
            size="lg"
            delta={deal.netYieldPct != null ? `neta ${deal.netYieldPct.toFixed(1)} %` : null}
            deltaTone="good"
            sub="Sobre coste real"
            series={tail(priceEvolution.rentM2)}
            onOpen={() => setDetailModal("roi")}
          />
          <MetricCard
            label="Coste real"
            value={fmt(deal.totalCost)}
            unit="€"
            sub={`Incluye ITP ${deal.taxPct.toFixed(1)} % y cierre`}
            onOpen={() => setDetailModal("roi")}
          />
          <MetricCard
            label="Compras en 12 m"
            value={notary?.operationsCount != null ? fmt(notary.operationsCount) : "—"}
            unit=""
            sub={notary?.period ? `Notariado · ${notary.period}` : "Sin dato notarial"}
            onOpen={() => setDetailModal("notary")}
          />
        </div>

        {/* ── Inversión ── */}
        <MetricSection title="Estimación de inversión" hint="Toca una fila para ver el cálculo">
          <MetricRow
            label="Precio de compra"
            value={`${fmt(roi.purchasePrice)} €`}
            onOpen={() => setDetailModal("roi")}
          />
          <MetricRow
            label={`Impuestos de compra (${roi.purchaseTaxPct} %)`}
            value={`${fmt(roi.purchaseTaxAmount)} €`}
            onOpen={() => setDetailModal("roi")}
          />
          <MetricRow
            label="Efectivo total invertido"
            value={`${fmt(roi.totalCashInvested)} €`}
            strong
            onOpen={() => setDetailModal("roi")}
          />
          <MetricRow
            label="Rentabilidad neta (82 % renta)"
            value={deal.netYieldPct != null ? `${deal.netYieldPct.toFixed(2)} %` : "—"}
            strong
            tone="good"
            onOpen={() => setDetailModal("roi")}
          />
          <div className="pt-2">
            <Link
              href={`/app/calculator?price=${Math.round(roi.purchasePrice)}&rent=${Math.round(roi.rentEstMonthly ?? 0)}`}
              className="text-[11px] font-semibold text-lime hover:underline"
            >
              Calculadora completa: hipoteca, IBI, cash-on-cash, flip, Airbnb →
            </Link>
          </div>
        </MetricSection>

        {/* ── Evolución ── */}
        <MetricSection
          title={`Evolución · ${priceTrendLabel}`}
          action={
            <button
              type="button"
              onClick={() => setDetailModal("trend")}
              className="text-[11px] font-semibold text-lime hover:underline"
            >
              Ver detalle →
            </button>
          }
        >
          {priceEvolution.saleM2.length >= 2 || priceEvolution.rentM2.length >= 2 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <MetricCard
                label="Venta €/m²"
                value={saleLast != null ? fmt(saleLast) : "—"}
                unit="€/m²"
                size="sm"
                delta={priceEvolution.saleM2.length >= 2 ? `${priceEvolution.saleChangePct.toFixed(1)} %` : null}
                deltaTone={priceEvolution.saleChangePct >= 0 ? "good" : "bad"}
                series={priceEvolution.saleM2}
                onOpen={() => setDetailModal("trend")}
              />
              <MetricCard
                label="Alquiler €/m²"
                value={rentLast != null ? rentLast.toFixed(1) : "—"}
                unit="€/m²·mes"
                size="sm"
                delta={priceEvolution.rentM2.length >= 2 ? `${priceEvolution.rentChangePct.toFixed(1)} %` : null}
                deltaTone={priceEvolution.rentChangePct >= 0 ? "good" : "bad"}
                series={priceEvolution.rentM2}
                onOpen={() => setDetailModal("trend")}
              />
            </div>
          ) : (
            <p className="py-3 text-[12px] text-ink-muted">
              Sin serie histórica para este CP. Se mostrará al sincronizar el notariado.
            </p>
          )}
        </MetricSection>

        {/* ── Barrio ── */}
        {neighborhood.listingPriceM2 != null && neighborhood.cpAvgPriceM2 != null && (
          <MetricSection title="Posición en el barrio">
            <div className="grid gap-2 sm:grid-cols-2">
              <MetricCard
                label="Este inmueble"
                value={fmt(neighborhood.listingPriceM2)}
                unit="€/m²"
                size="sm"
                delta={
                  neighborhood.vsCpPct != null ? `${neighborhood.vsCpPct > 0 ? "+" : ""}${neighborhood.vsCpPct.toFixed(1)} %` : null
                }
                deltaTone={(neighborhood.vsCpPct ?? 0) <= 0 ? "good" : "bad"}
                sub="vs media del CP"
                onOpen={() => setDetailModal("barrio")}
              />
              <MetricCard
                label="Media del CP"
                value={fmt(neighborhood.cpAvgPriceM2)}
                unit="€/m²"
                size="sm"
                sub={postalCode ? `CP ${postalCode}` : "Provincia"}
                onOpen={() => setDetailModal("barrio")}
              />
            </div>
          </MetricSection>
        )}

        {/* ── Habitaciones ── */}
        {roomRent && (
          <MetricSection title="Alquiler por habitaciones">
            <MetricRow
              label="Estimación agresiva"
              value={`${fmt(roomRent.estimatePerRoom ?? 0)} €/hab`}
              hint={`${roomRent.bedrooms} habitaciones · ${fmt(roomRent.totalEstimateMonthly ?? 0)} €/mes`}
            />
            <MetricRow
              label="Escenario conservador"
              value={`${fmt(roomRent.conservativePerRoom ?? 0)} €/hab`}
              tone="muted"
            />
          </MetricSection>
        )}

        {/* ── Comparables ── */}
        <MetricSection
          title={roomRent ? "Alquiler piso entero (referencia)" : "Comparables de alquiler (500 m)"}
          hint={`${comparables.length} anuncios activos`}
        >
          {comparables.length === 0 ? (
            <p className="py-2 text-[12px] text-ink-muted">
              Sin alquileres activos en radio — usamos la renta del modelo.
            </p>
          ) : (
            comparables.map((c) => (
              <MetricRow
                key={c.id}
                label={c.title ?? "Alquiler"}
                value={`${fmt(c.price)} €/mes`}
                hint={`${Math.round(c.distanceM)} m · ${c.sqm != null ? `${Math.round(c.sqm)} m²` : "s/d"}`}
              />
            ))
          )}
        </MetricSection>

        {/* ── Notariado ── */}
        {notary?.portal ? (
          <div role="presentation" onClick={() => setDetailModal("notary")}>
            <NotariadoPortalPanel portal={notary.portal} />
          </div>
        ) : (
          notary && (
            <MetricSection
              title={`Mercado notarial${postalCode ? ` · CP ${postalCode}` : ""}`}
              action={
                <button
                  type="button"
                  onClick={() => setDetailModal("notary")}
                  className="text-[11px] font-semibold text-lime hover:underline"
                >
                  Detalle →
                </button>
              }
            >
              <MetricRow label="Precio medio por m²" value={notary.priceM2 != null ? `${fmt(notary.priceM2)} €` : "—"} />
              <MetricRow label="Precio medio de venta" value={notary.avgPrice != null ? `${fmt(notary.avgPrice)} €` : "—"} />
              <MetricRow label="Superficie media" value={notary.avgSurface != null ? `${fmt(notary.avgSurface)} m²` : "—"} />
              <MetricRow label="Compraventas" value={notary.operationsCount != null ? String(notary.operationsCount) : "—"} />
              {notary.period && (
                <p className="pt-2 text-[10px] text-ink-muted/70">
                  Periodo {notary.period} · Notariado{notary.esEstimado ? " (est.)" : ""}
                </p>
              )}
            </MetricSection>
          )
        )}

        {/* ── Índices oficiales ── */}
        {officialMarket.length > 0 && (
          <MetricSection title="Índices oficiales (provincia)">
            {officialMarket.map((o) => {
              const m = o.metrics as Record<string, unknown>;
              const idx = m.priceIndexLibre ?? (m.barcelonaLibre as { priceIndex?: number } | undefined)?.priceIndex;
              return (
                <MetricRow
                  key={`${o.source}-${o.period}`}
                  label={o.source}
                  hint={`Periodo ${o.period}`}
                  value={idx != null ? Number(idx).toLocaleString("es-ES") : "—"}
                />
              );
            })}
          </MetricSection>
        )}

        {/* ── Demografía ── */}
        <MetricSection title="Entorno (INE)">
          {"note" in summary.demographics ? (
            <p className="py-2 text-[12px] text-ink-muted">{summary.demographics.note}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 pb-1">
                <MetricCard
                  label="Población"
                  value={summary.demographics.population != null ? fmt(summary.demographics.population) : "—"}
                  size="sm"
                />
                <MetricCard
                  label="Renta neta media"
                  value={summary.demographics.meanNetIncomeEur != null ? fmt(summary.demographics.meanNetIncomeEur) : "—"}
                  unit="€"
                  size="sm"
                />
                <MetricCard
                  label="Educación superior"
                  value={
                    summary.demographics.tertiaryEducationPct != null
                      ? fmt(summary.demographics.tertiaryEducationPct, 1)
                      : "—"
                  }
                  unit="%"
                  size="sm"
                />
                <MetricCard
                  label="Paro"
                  value={
                    summary.demographics.unemploymentPct != null ? fmt(summary.demographics.unemploymentPct, 1) : "—"
                  }
                  unit="%"
                  size="sm"
                  deltaTone="bad"
                />
              </div>
              <p className="text-[10px] text-ink-muted/70">
                Sección {summary.demographics.cusec}
                {summary.demographics.sectionName ? ` · ${summary.demographics.sectionName}` : ""}
                {summary.demographics.metricsYear ? ` · ${summary.demographics.metricsYear}` : ""}
                {summary.demographics.sourceUrl && (
                  <>
                    {" · "}
                    <a href={summary.demographics.sourceUrl} className="underline" target="_blank" rel="noreferrer">
                      INE
                    </a>
                  </>
                )}
              </p>
            </>
          )}
        </MetricSection>

        {/* ── Desarrollos / lugares ── */}
        {summary.localDevelopments.length > 0 && (
          <MetricSection title="Desarrollos locales (referencia)">
            {summary.localDevelopments.map((d) => (
              <MetricRow
                key={d.title}
                label={d.title}
                hint={`${d.category} · ${d.year} — ${d.description}`}
                value=""
              />
            ))}
          </MetricSection>
        )}

        {summary.nearbyPlaces.note && (
          <MetricSection title="Lugares cercanos">
            <p className="py-2 text-[12px] leading-relaxed text-ink-muted">{summary.nearbyPlaces.note}</p>
          </MetricSection>
        )}
      </div>

      <MetricDetailModal
        open={detailModal === "roi"}
        title="Estimación de inversión"
        subtitle="Cash, impuestos y rentabilidad"
        onClose={() => setDetailModal(null)}
      >
        <div className="space-y-1">
          <MetricRow
            label="Alquiler estimado"
            value={roi.rentEstMonthly != null ? `${fmt(roi.rentEstMonthly)} €/mes` : "—"}
          />
          <MetricRow label="Precio de compra" value={`${fmt(roi.purchasePrice)} €`} />
          <MetricRow label={`Impuestos (${roi.purchaseTaxPct} %)`} value={`${fmt(roi.purchaseTaxAmount)} €`} />
          <MetricRow label="Gastos de cierre" value={`${fmt(deal.closingCosts)} €`} />
          <MetricRow label="Coste real de la operación" value={`${fmt(deal.totalCost)} €`} strong />
          <MetricRow label="Efectivo total invertido" value={`${fmt(roi.totalCashInvested)} €`} strong />
          <MetricRow
            label="ROI bruto"
            value={roi.grossRoiPct != null ? `${roi.grossRoiPct.toFixed(2)} %` : "—"}
            strong
            tone="good"
          />
          <MetricRow
            label="Rentabilidad neta"
            value={deal.netYieldPct != null ? `${deal.netYieldPct.toFixed(2)} %` : "—"}
            strong
            tone="good"
          />
        </div>
        <Link
          href={`/app/calculator?price=${Math.round(roi.purchasePrice)}&rent=${Math.round(roi.rentEstMonthly ?? 0)}`}
          className="mt-4 inline-flex rounded-full bg-lime px-4 py-2 text-xs font-bold text-lime-ink"
        >
          Abrir calculadora
        </Link>
      </MetricDetailModal>

      <MetricDetailModal
        open={detailModal === "trend"}
        title="Evolución de precios"
        subtitle={priceTrendLabel}
        onClose={() => setDetailModal(null)}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <MetricCard
            label="Venta €/m²"
            value={saleLast != null ? fmt(saleLast) : "—"}
            unit="€/m²"
            delta={priceEvolution.saleM2.length >= 2 ? `${priceEvolution.saleChangePct.toFixed(1)} %` : null}
            series={priceEvolution.saleM2}
          />
          <MetricCard
            label="Alquiler €/m²·mes"
            value={rentLast != null ? rentLast.toFixed(1) : "—"}
            delta={priceEvolution.rentM2.length >= 2 ? `${priceEvolution.rentChangePct.toFixed(1)} %` : null}
            series={priceEvolution.rentM2}
          />
        </div>
        <p className="mt-3 text-[11px] text-ink-muted">
          {priceEvolution.sourceLabel ?? "Serie basada en estadísticas del CP."}
        </p>
      </MetricDetailModal>

      <MetricDetailModal
        open={detailModal === "neighborhood" || detailModal === "barrio"}
        title="Posición vs media del CP"
        onClose={() => setDetailModal(null)}
      >
        {neighborhood.listingPriceM2 != null && neighborhood.cpAvgPriceM2 != null && (
          <div className="grid gap-2 sm:grid-cols-2">
            <MetricCard
              label="Este inmueble"
              value={fmt(neighborhood.listingPriceM2)}
              unit="€/m²"
              delta={
                neighborhood.vsCpPct != null
                  ? `${neighborhood.vsCpPct > 0 ? "+" : ""}${neighborhood.vsCpPct.toFixed(1)} %`
                  : null
              }
              deltaTone={(neighborhood.vsCpPct ?? 0) <= 0 ? "good" : "bad"}
            />
            <MetricCard label="Media del CP" value={fmt(neighborhood.cpAvgPriceM2)} unit="€/m²" />
          </div>
        )}
      </MetricDetailModal>

      <MetricDetailModal
        open={detailModal === "notary"}
        title="Mercado notarial"
        subtitle={postalCode ? `CP ${postalCode}` : undefined}
        onClose={() => setDetailModal(null)}
      >
        {notary?.portal ? (
          <NotariadoPortalPanel portal={notary.portal} />
        ) : notary ? (
          <div className="space-y-1">
            <MetricRow label="Precio medio por m²" value={notary.priceM2 != null ? `${fmt(notary.priceM2)} €` : "—"} />
            <MetricRow label="Precio medio de venta" value={notary.avgPrice != null ? `${fmt(notary.avgPrice)} €` : "—"} />
            <MetricRow label="Superficie media" value={notary.avgSurface != null ? `${fmt(notary.avgSurface)} m²` : "—"} />
            <MetricRow label="Compraventas" value={notary.operationsCount != null ? String(notary.operationsCount) : "—"} />
          </div>
        ) : (
          <p className="text-[12px] text-ink-muted">Sin datos notariales para esta zona.</p>
        )}
      </MetricDetailModal>
    </>
  );
}
