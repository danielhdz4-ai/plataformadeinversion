import { MonthlyBarChart } from "@/components/notariado/MonthlyBarChart";
import { periodLabel } from "@/lib/notariado/normalize-portal";
import type { NotaryPortalStats } from "@/lib/notariado/types";

function fmt(n: number, d = 0) {
  return n.toLocaleString("es-ES", { maximumFractionDigits: d });
}

export function NotariadoPortalPanel({ portal }: { portal: NotaryPortalStats }) {
  const { summary, monthly, additional, sociodemographic } = portal;

  return (
    <div className="space-y-3 text-xs text-neutral-800">
      <div className="rounded-lg border border-neutral-200 bg-white p-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Portal estadístico del Notariado
            </p>
            <p className="font-semibold text-neutral-950">
              CP {portal.postalCode}
              {portal.placeName ? ` · ${portal.placeName}` : ""}
            </p>
            <p className="text-[10px] text-neutral-500">
              {periodLabel(portal)} · Informe {portal.reportDate} · {portal.filters.propertyType} /{" "}
              {portal.filters.constructionType}
            </p>
          </div>
          <a
            href={portal.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-medium text-neutral-700 underline"
          >
            penotariado.com
          </a>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label="Precio medio" value={`${fmt(summary.priceM2)} €/m²`} />
          <Kpi label="Compraventas" value={String(summary.salesCount)} />
          <Kpi label="Importe medio" value={`${fmt(summary.avgAmount)} €`} />
          <Kpi label="Superficie media" value={`${fmt(summary.avgSurface)} m²`} />
        </div>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-2.5">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Evolución precio €/m² (12 meses)
        </h4>
        <p className="mt-0.5 text-lg font-bold tabular-nums text-neutral-950">{fmt(summary.priceM2)} €/m²</p>
        <div className="mt-2">
          <MonthlyBarChart
            labels={monthly.labels}
            values={monthly.priceM2}
            formatValue={(n) => `${fmt(n)} €/m²`}
          />
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-2.5">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Número de compraventas (12 meses)
        </h4>
        <MonthlyBarChart labels={monthly.labels} values={monthly.salesCount} />
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-2.5">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Importe medio (12 meses)
        </h4>
        <MonthlyBarChart
          labels={monthly.labels}
          values={monthly.avgAmount}
          formatValue={(n) => `${fmt(n)} €`}
        />
      </section>

      {additional && (
        <section className="rounded-lg border border-neutral-200 bg-white p-2.5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Indicadores adicionales
          </h4>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            {additional.priceChangePct12m != null && (
              <Row label="Variación precio 12 m" value={`${additional.priceChangePct12m > 0 ? "+" : ""}${additional.priceChangePct12m.toFixed(2)} %`} />
            )}
            {additional.medianPriceM2 != null && (
              <Row label="Mediana €/m²" value={`${fmt(additional.medianPriceM2)} €/m²`} />
            )}
            {additional.newBuildPct != null && (
              <Row label="Vivienda nueva" value={`${additional.newBuildPct.toFixed(2)} %`} />
            )}
            {additional.secondHandPct != null && (
              <Row label="Segunda mano" value={`${additional.secondHandPct.toFixed(2)} %`} />
            )}
            {additional.housesPct != null && (
              <Row label="Casas" value={`${additional.housesPct.toFixed(2)} %`} />
            )}
            {additional.flatsPct != null && (
              <Row label="Pisos" value={`${additional.flatsPct.toFixed(2)} %`} />
            )}
          </dl>
        </section>
      )}

      {sociodemographic && (
        <section className="rounded-lg border border-neutral-200 bg-white p-2.5">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Indicadores sociodemográficos (compradores)
          </h4>
          {sociodemographic.medianBuyerAge != null && (
            <p className="mt-1 font-semibold text-neutral-950">
              Edad mediana compradores: {sociodemographic.medianBuyerAge} años
            </p>
          )}
          <ul className="mt-2 space-y-1">
            {sociodemographic.buyerAgeDistribution.map((b) => (
              <li key={b.band} className="flex justify-between gap-2">
                <span className="text-neutral-600">{b.band}</span>
                <span className="font-medium tabular-nums">{b.pct.toFixed(2)} %</span>
              </li>
            ))}
          </ul>
          {(sociodemographic.nationalBuyersPct != null || sociodemographic.foreignBuyersPct != null) && (
            <div className="mt-2 flex gap-4 text-[11px]">
              {sociodemographic.nationalBuyersPct != null && (
                <span>Nacionales: {sociodemographic.nationalBuyersPct.toFixed(2)} %</span>
              )}
              {sociodemographic.foreignBuyersPct != null && (
                <span>Extranjeros: {sociodemographic.foreignBuyersPct.toFixed(2)} %</span>
              )}
            </div>
          )}
          {sociodemographic.foreignByNationality.length > 0 && (
            <table className="mt-2 w-full text-[10px]">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th>País</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {sociodemographic.foreignByNationality.map((f) => (
                  <tr key={f.country}>
                    <td>{f.country}</td>
                    <td className="text-right tabular-nums">{f.totalPct.toFixed(2)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <p className="text-[9px] text-neutral-500">
        Datos de compraventas ante notario (IUIN). No se muestran zonas con &lt;4 operaciones (confidencialidad).
        Fuente: Consejo General del Notariado.
      </p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#faf9f7] p-2">
      <p className="text-[9px] uppercase text-neutral-500">{label}</p>
      <p className="font-bold tabular-nums text-neutral-950">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-neutral-600">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
