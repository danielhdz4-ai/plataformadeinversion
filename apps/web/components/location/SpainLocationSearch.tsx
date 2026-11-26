"use client";

import type { GeocodeHit } from "@/lib/map/geocode-spain";
import { useSpainGeocodeSuggestions } from "@/lib/hooks/use-spain-geocode-suggestions";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onPick: (hit: GeocodeHit) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
};

export function SpainLocationSearch({
  value,
  onChange,
  onPick,
  placeholder = "CP (5 dígitos) o barrio — ej. 08940, Sants",
  className = "",
  inputClassName,
}: Props) {
  const { suggestions, loading, error, isCompleteCp } = useSpainGeocodeSuggestions(value);

  /** Enter resuelve directo si aún no había sugerencias (CP recién escrito, red lenta…). */
  async function resolveAndPick() {
    if (suggestions[0]) {
      onPick(suggestions[0]);
      return;
    }
    const q = value.trim();
    if (q.length < 2) return;
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { results?: GeocodeHit[] };
      const hit = data.results?.[0];
      if (hit) onPick(hit);
    } catch {
      /* sin sugerencias */
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void resolveAndPick();
          }
          if (e.key === "Escape") onChange(value.trim());
        }}
        inputMode={/^\d*$/.test(value) ? "numeric" : "text"}
        placeholder={placeholder}
        className={
          inputClassName ??
          "w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/5"
        }
        aria-autocomplete="list"
      />
      {loading && (
        <p className="mt-1 text-[11px] text-neutral-500">Buscando…</p>
      )}
      {!loading && /^\d+$/.test(value.trim()) && value.trim().length > 0 && value.trim().length < 4 && (
        <p className="mt-1 text-[11px] text-neutral-500">Escribe al menos 4 dígitos del CP</p>
      )}
      {!loading && isCompleteCp && suggestions.length === 0 && !error && (
        <p className="mt-1 text-[11px] text-neutral-500">Resolviendo CP… pulsa Enter</p>
      )}
      {error && <p className="mt-1 text-[11px] text-amber-800">{error}</p>}
      {suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-lg border bg-white shadow-lg">
          {suggestions.map((s, idx) => (
            <li key={`${s.lat},${s.lng},${idx}`}>
              <button
                type="button"
                onClick={() => onPick(s)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-100"
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
