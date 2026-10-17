export function RangeField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-neutral-800">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-neutral-950">
          {suffix?.includes("€") ? `${value.toLocaleString("es-ES")} ${suffix}` : `${value}${suffix ?? ""}`}
        </span>
      </div>
      {hint && <p className="mt-0.5 text-[11px] text-neutral-500">{hint}</p>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-2 w-full cursor-pointer accent-neutral-950"
      />
      <div className="mt-0.5 flex justify-between text-[10px] text-neutral-400">
        <span>{min}{suffix}</span>
        <span>{max}{suffix}</span>
      </div>
    </label>
  );
}
