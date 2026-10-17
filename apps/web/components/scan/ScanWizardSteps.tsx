const STEPS = ["Ubicación", "Operación", "Detalles"] as const;

export function ScanWizardSteps({ step }: { step: number }) {
  return (
    <ol className="flex flex-wrap gap-2 text-xs font-medium">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li
            key={label}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
              active
                ? "bg-neutral-950 text-white"
                : done
                  ? "bg-neutral-200 text-neutral-800"
                  : "bg-neutral-100 text-neutral-500"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">
              {done ? "·" : i + 1}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
