export function MonthlyBarChart({
  labels,
  values,
  formatValue = (n) => n.toLocaleString("es-ES"),
  height = 72,
}: {
  labels: string[];
  values: number[];
  formatValue?: (n: number) => string;
  height?: number;
}) {
  if (values.length === 0) return null;
  const max = Math.max(...values) * 1.08 || 1;
  return (
    <div className="space-y-1">
      <div className="flex items-end gap-0.5" style={{ height }}>
        {values.map((v, i) => (
          <div
            key={labels[i] ?? i}
            className="min-w-0 flex-1 rounded-t bg-neutral-800/85"
            style={{ height: `${(v / max) * 100}%` }}
            title={`${labels[i]}: ${formatValue(v)}`}
          />
        ))}
      </div>
      <div className="flex gap-0.5 text-[8px] text-neutral-500">
        {labels.map((l) => (
          <span key={l} className="min-w-0 flex-1 truncate text-center">
            {l.slice(5)}
          </span>
        ))}
      </div>
    </div>
  );
}
