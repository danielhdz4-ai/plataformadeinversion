import type { ReactNode } from "react";

export function fmtEuro(n: number, decimals = 0) {
  return n.toLocaleString("es-ES", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

export function CalcSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-neutral-200 pb-5">
      <h3 className="text-sm font-semibold text-neutral-950">{title}</h3>
      {children}
    </section>
  );
}

export function TaxSummaryBox({ total, pct, price }: { total: number; pct: number; price: number }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
      Costes totales de compra: <strong>{fmtEuro(total)} €</strong> ({pct.toFixed(1)} % del precio · base{" "}
      {fmtEuro(price)} €)
    </div>
  );
}

export function ResultCard({
  accent,
  title,
  headline,
  sub,
  children,
}: {
  accent: "green" | "blue" | "purple" | "neutral";
  title: string;
  headline: string;
  sub?: string;
  children: ReactNode;
}) {
  const border = {
    green: "border-l-emerald-600",
    blue: "border-l-blue-600",
    purple: "border-l-violet-600",
    neutral: "border-l-neutral-950",
  }[accent];
  return (
    <div className={`rounded-xl border border-neutral-200 bg-white p-4 border-l-4 ${border}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-neutral-950">{headline}</p>
      {sub && <p className="text-xs text-neutral-500">{sub}</p>}
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
  const color =
    tone === "pos" ? "text-emerald-700" : tone === "neg" ? "text-red-600" : "text-neutral-700";
  return (
    <div>
      <div className={`flex justify-between gap-2 ${color}`}>
        <dt>{label}</dt>
        <dd className="font-medium tabular-nums">{value}</dd>
      </div>
      {sub && <div className="ml-3 mt-0.5 space-y-0.5 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}
