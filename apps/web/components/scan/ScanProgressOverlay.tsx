const STEPS = [
  "Recopilando datos de la zona",
  "Buscando anuncios (kelify · pisos.com)",
  "Estimando alquiler y ROI",
] as const;

export function ScanProgressOverlay({ activeStep = 1 }: { activeStep?: number }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/85 p-6">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-8 shadow-lg">
        <h2 className="text-lg font-semibold text-neutral-950">Escaneando tu zona</h2>
        <ol className="mt-6 space-y-4">
          {STEPS.map((label, i) => {
            const done = i < activeStep;
            const current = i === activeStep;
            return (
              <li key={label} className="flex gap-3 text-sm text-neutral-700">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    done ? "bg-neutral-950 text-white" : current ? "bg-neutral-800 text-white" : "bg-neutral-200"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                {label}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
