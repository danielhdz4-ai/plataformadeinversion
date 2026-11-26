import { MonthlyBarChart } from "@/components/notariado/MonthlyBarChart";
import { MetricCard, MetricRow, MetricSection } from "@/components/ui/MetricCard";
import { periodLabel } from "@/lib/notariado/normalize-portal";
import type { NotaryPortalStats } from "@/lib/notariado/types";

function fmt(n: number, d = 0) {
  return n.toLocaleString("es-ES", { maximumFractionDigits: d });
}

export function NotariadoPortalPanel({ portal }: { portal: NotaryPortalStats }) {
  const { summary, monthly, additional, sociodemographic } = portal;

  return (
    <div className="space-y-3">
      <MetricSection
        title="Portal estadístico del Notariado"
        hint={`${periodLabel(portal)} · informe ${portal.reportDate}`}
        action={
          <a
            href={portal.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-semibold text-lime hover:underline"
          >
            penotariado.com ↗
          </a>
        }
      >
        <p className="pb-2 text-[12px] font-semibold text-ink">
          {portal.postalCode === "ES000"
            ? portal.placeName ?? "España"
            : `CP ${portal.postalCode}${portal.placeName ? ` · ${portal.placeName}` : ""}`}
          <span className="ml-2 text-[10px] font-normal text-ink-muted">
            {portal.filters.propertyType} / {portal.filters.constructionType}
          </span>
        </p>
        {portal.postalCode === "ES000" && (
          <p className="pb-2 text-[10px] text-amber-500">
            Referencia nacional — importa el CP del anuncio para precisión local.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 pb-2">
          <MetricCard label="Precio medio" value={fmt(summary.priceM2)} unit="€/m²" size="sm" />
          <MetricCard label="Compraventas" value={String(summary.salesCount)} size="sm" />
          <MetricCard label="Importe medio" value={fmt(summary.avgAmount)} unit="€" size="sm" />
          <MetricCard label="Superficie media" value={fmt(summary.avgSurface)} unit="m²" size="sm" />
        </div>
      </MetricSection>

      <MetricSection title="Evolución precio €/m² · 12 meses">
        <div className="pb-2">
          <MonthlyBarChart
            labels={monthly.labels}
            values={monthly.priceM2}
            formatValue={(n) => `${fmt(n)} €/m²`}
          />
        </div>
      </MetricSection>

      <MetricSection title="Compraventas · 12 meses">
        <div className="pb-2">
          <MonthlyBarChart labels={monthly.labels} values={monthly.salesCount} />
        </div>
      </MetricSection>

      <MetricSection title="Importe medio · 12 meses">
        <div className="pb-2">
          <MonthlyBarChart
            labels={monthly.labels}
            values={monthly.avgAmount}
            formatValue={(n) => `${fmt(n)} €`}
          />
        </div>
      </MetricSection>

      {additional && (
        <MetricSection title="Indicadores adicionales">
          {additional.priceChangePct12m != null && (
            <MetricRow
              label="Variación precio 12 m"
              value={`${additional.priceChangePct12m > 0 ? "+" : ""}${additional.priceChangePct12m.toFixed(2)} %`}
              tone={additional.priceChangePct12m >= 0 ? "good" : "bad"}
            />
          )}
          {additional.medianPriceM2 != null && (
            <MetricRow label="Mediana €/m²" value={`${fmt(additional.medianPriceM2)} €/m²`} />
          )}
          {additional.newBuildPct != null && (
            <MetricRow label="Vivienda nueva" value={`${additional.newBuildPct.toFixed(2)} %`} />
          )}
          {additional.secondHandPct != null && (
            <MetricRow label="Segunda mano" value={`${additional.secondHandPct.toFixed(2)} %`} />
          )}
          {additional.housesPct != null && (
            <MetricRow label="Casas" value={`${additional.housesPct.toFixed(2)} %`} />
          )}
          {additional.flatsPct != null && (
            <MetricRow label="Pisos" value={`${additional.flatsPct.toFixed(2)} %`} />
          )}
        </MetricSection>
      )}

      {sociodemographic && (
        <MetricSection title="Compradores (sociodemográfico)">
          {sociodemographic.medianBuyerAge != null && (
            <MetricCard
              label="Edad mediana comprador"
              value={String(sociodemographic.medianBuyerAge)}
              unit="años"
              size="sm"
              className="mb-2"
            />
          )}
          {sociodemographic.buyerAgeDistribution.map((b) => (
            <MetricRow key={b.band} label={b.band} value={`${b.pct.toFixed(2)} %`} />
          ))}
          {sociodemographic.nationalBuyersPct != null && (
            <MetricRow label="Compradores nacionales" value={`${sociodemographic.nationalBuyersPct.toFixed(2)} %`} />
          )}
          {sociodemographic.foreignBuyersPct != null && (
            <MetricRow label="Compradores extranjeros" value={`${sociodemographic.foreignBuyersPct.toFixed(2)} %`} />
          )}
          {sociodemographic.foreignByNationality.map((f) => (
            <MetricRow key={f.country} label={f.country} value={`${f.totalPct.toFixed(2)} %`} />
          ))}
        </MetricSection>
      )}

      <p className="text-[10px] leading-snug text-ink-muted/70">
        Datos de compraventas ante notario (IUIN). No se muestran zonas con &lt;4 operaciones (confidencialidad).
        Fuente: Consejo General del Notariado.
      </p>
    </div>
  );
}
