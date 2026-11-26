import type { ReactNode } from "react";

export function fmtEuro(n: number, decimals = 0) {
  return n.toLocaleString("es-ES", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

export function CalcSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-line pb-5 last:border-0">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">{title}</h3>
      {children}
    </section>
  );
}

export function TaxSummaryBox({ total, pct, price }: { total: number; pct: number; price: number }) {
  return (
    <div className="rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-ink">
      Costes totales de compra: <strong className="tabular-nums">{fmtEuro(total)} €</strong> (
      <span className="tabular-nums">{pct.toFixed(1)} %</span> del precio · base{" "}
      <span className="tabular-nums">{fmtEuro(price)} €</span>)
    </div>
  );
}

/** Tarjeta de resultado: misma piel para todos los escenarios. */
export function ResultCard({
  accent = "neutral",
  title,
  headline,
  sub,
  children,
}: {
  accent?: "green" | "blue" | "purple" | "neutral";
  title: string;
  headline: string;
  sub?: string;
  children: ReactNode;
}) {
  const rail = {
    green: "before:bg-lime",
    blue: "before:bg-mint",
    purple: "before:bg-amber",
    neutral: "before:bg-ink-muted",
  }[accent];
  return (
    <div
      className={`brasa-card relative overflow-hidden p-4 pl-5 before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[''] ${rail}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">{title}</p>
      <p className="mt-1 text-[26px] font-extrabold leading-none tabular-nums tracking-tight text-ink">{headline}</p>
      {sub && <p className="text-xs text-ink-muted">{sub}</p>}
      <dl className="mt-3 space-y-1.5 text-sm">{children}</dl>
    </div>
  );
}

export function Line({
  label,
  value,
  tone = "neutral",
  sub,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "neutral";
  sub?: ReactNode;
}) {
  const color = tone === "pos" ? "text-lime" : tone === "neg" ? "text-clay" : "text-ink";
  return (
    <div className="border-b border-line/50 pb-1.5 last:border-0">
      <div className={`flex justify-between gap-2 text-[13px] ${color}`}>
        <dt className="text-ink-muted">{label}</dt>
        <dd className="font-semibold tabular-nums">{value}</dd>
      </div>
      {sub && <div className="mt-0.5 space-y-0.5 text-[11px] text-ink-muted/80">{sub}</div>}
    </div>
  );
}
