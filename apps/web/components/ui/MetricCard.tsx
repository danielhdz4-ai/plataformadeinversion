"use client";

import { useId, type ReactNode } from "react";

/**
 * Sistema único de métricas (Brasa).
 * Toda cifra de la app —ROI, €/m², evolución, barrio, notariado, INE—
 * se muestra con estos bloques: misma tipografía, mismo color, misma
 * interacción (todo abre detalle).
 */

function Sparkline({
  points,
  className = "",
  strokeWidth = 2,
}: {
  points: { x: string; y: number }[];
  className?: string;
  strokeWidth?: number;
}) {
  const gid = useId().replace(/:/g, "");
  if (points.length < 2) return null;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const w = 100;
  const h = 30;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p.y - min) / span) * (h - 6) - 3;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const id = `spark-${gid}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={`h-8 w-full ${className}`} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--t-lime)" stopOpacity="0.38" />
          <stop offset="100%" stopColor="var(--t-lime)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${coords.join(" ")} ${w},${h}`} fill={`url(#${id})`} />
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="var(--t-lime)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export type MetricTone = "default" | "good" | "bad" | "muted";

const toneClass: Record<MetricTone, string> = {
  default: "text-ink",
  good: "text-lime",
  bad: "text-clay",
  muted: "text-ink-muted",
};

/**
 * Tarjeta de métrica honesta: etiqueta, cifra, delta opcional,
 * sparkline opcional y nota de fuente. Si recibe `onOpen`,
 * toda la tarjeta es interactiva y se puede abrir en detalle.
 */
export function MetricCard({
  label,
  value,
  unit,
  delta,
  deltaTone = "default",
  sub,
  note,
  series,
  onOpen,
  className = "",
  size = "md",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: string | null;
  deltaTone?: MetricTone;
  sub?: ReactNode;
  note?: ReactNode;
  series?: { x: string; y: number }[];
  onOpen?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const isButton = Boolean(onOpen);
  const Tag = isButton ? "button" : "div";
  const valueSize =
    size === "lg" ? "text-[26px]" : size === "sm" ? "text-[17px]" : "text-[21px]";
  return (
    <Tag
      type={isButton ? "button" : undefined}
      onClick={onOpen}
      className={`brasa-card group block w-full px-4 py-3.5 text-left ${
        isButton ? "cursor-pointer" : ""
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">{label}</p>
        {isButton && (
          <span className="text-[11px] text-ink-muted/50 transition group-hover:text-lime">›</span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
        <span className={`font-extrabold leading-none tracking-tight tabular-nums text-ink ${valueSize}`}>
          {value}
        </span>
        {unit && <span className="text-xs font-semibold text-ink-muted">{unit}</span>}
        {delta && (
          <span className={`ml-0.5 text-[11px] font-bold tabular-nums ${toneClass[deltaTone]}`}>{delta}</span>
        )}
      </div>
      {series && series.length >= 2 && (
        <div className="mt-2 -mx-1">
          <Sparkline points={series} />
        </div>
      )}
      {(sub || note) && (
        <div className="mt-1.5 space-y-0.5">
          {sub && <p className="text-[11px] leading-snug text-ink-muted">{sub}</p>}
          {note && <p className="text-[10px] leading-snug text-ink-muted/70">{note}</p>}
        </div>
      )}
    </Tag>
  );
}

/** Fila de métrica: la unidad dentro de una lista comparativa. */
export function MetricRow({
  label,
  value,
  hint,
  onOpen,
  strong,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  onOpen?: () => void;
  strong?: boolean;
  tone?: MetricTone;
}) {
  const isButton = Boolean(onOpen);
  const Tag = isButton ? "button" : "div";
  return (
    <Tag
      type={isButton ? "button" : undefined}
      onClick={onOpen}
      className={`group flex w-full items-start justify-between gap-3 border-b border-line/60 py-2 text-left last:border-0 ${
        isButton ? "cursor-pointer hover:border-lime/40" : ""
      }`}
    >
      <span className="min-w-0">
        <span className={`block text-[12px] ${strong ? "font-semibold text-ink" : "text-ink-muted"}`}>
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-[10px] leading-snug text-ink-muted/70">{hint}</span>}
      </span>
      <span
        className={`shrink-0 tabular-nums ${
          strong ? "text-[13px] font-bold" : "text-[13px] font-semibold"
        } ${toneClass[tone]} ${isButton ? "group-hover:text-lime" : ""}`}
      >
        {value}
      </span>
    </Tag>
  );
}

/** Contenedor-título de bloque: mismo peso y espaciado en toda la app. */
export function MetricSection({
  title,
  hint,
  action,
  children,
  className = "",
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`brasa-card overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink">{title}</h3>
          {hint && <p className="mt-0.5 text-[10px] text-ink-muted">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="px-4 py-2">{children}</div>
    </section>
  );
}

export function MetricDelta({ pct }: { pct: number | null | undefined }) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const good = pct >= 0;
  return (
    <span className={`text-[11px] font-bold tabular-nums ${good ? "text-lime" : "text-clay"}`}>
      {good ? "+" : ""}
      {pct.toFixed(1)} %
    </span>
  );
}

export { Sparkline };
