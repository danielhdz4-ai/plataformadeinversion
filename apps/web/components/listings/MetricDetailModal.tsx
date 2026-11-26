"use client";

import { useEffect, type ReactNode } from "react";

/** Modal de detalle de métrica, con el mismo lenguaje Brasa que el resto. */
export function MetricDetailModal({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="metric-modal-title"
        className="brasa-rise relative max-h-[min(88vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl"
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line bg-surface px-5 py-4">
          <div>
            <h2 id="metric-modal-title" className="text-base font-bold tracking-tight text-ink">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-lg leading-none text-ink-muted transition hover:bg-raised hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4 text-sm text-ink">{children}</div>
      </div>
    </div>
  );
}

export { MetricRow as MetricRowButton } from "@/components/ui/MetricCard";
