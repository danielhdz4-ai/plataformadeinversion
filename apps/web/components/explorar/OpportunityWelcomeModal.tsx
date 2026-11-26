"use client";

import type { ScanOperation } from "@/lib/investment/operations";
import { SpainLocationSearch } from "@/components/location/SpainLocationSearch";
import type { GeocodeHit } from "@/lib/map/geocode-spain";
import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "pi-welcome-radar-v2";

type IntentId = ScanOperation | "live_home";

const INTENTS: { id: IntentId; title: string; sub: string }[] = [
  { id: "live_home", title: "Un hogar", sub: "Una vivienda a buen precio." },
  { id: "buy_to_rent", title: "Alquiler tradicional", sub: "Una renta estable, a largo plazo." },
  { id: "buy_to_rent_rooms", title: "Máxima rentabilidad", sub: "Por habitaciones o alquiler turístico." },
  { id: "flip", title: "Reformar y vender", sub: "Comprar con descuento, reformar y revender." },
];

type Props = {
  onApply: (payload: { intent: IntentId; postalCode: string | null; label: string | null }) => void;
};

export function OpportunityWelcomeModal({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<IntentId>("buy_to_rent");
  const [query, setQuery] = useState("");
  const [pickedCp, setPickedCp] = useState<string | null>(null);
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
      setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  function onPick(hit: GeocodeHit) {
    setPickedLabel(hit.label);
    setQuery(hit.label);
    const cp = hit.label.match(/\b(\d{5})\b/)?.[1] ?? null;
    setPickedCp(cp);
  }

  function go() {
    onApply({ intent, postalCode: pickedCp, label: pickedLabel });
    dismiss();
  }

  const canGo = Boolean(pickedCp || query.trim().length >= 4);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-labelledby="welcome-title"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.25)]"
      >
        <div className="border-b border-neutral-100 px-6 py-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-xl text-white shadow-md">
            ◎
          </div>
          <h2 id="welcome-title" className="mt-4 text-xl font-bold tracking-tight text-neutral-950">
            Bienvenido
          </h2>
          <p className="mt-2 text-xs text-neutral-500">
            Valoración notarial · rentabilidad estimada · score de oportunidad
          </p>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">¿Qué estás buscando?</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {INTENTS.map((item) => (
                <label
                  key={item.id}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                    intent === item.id
                      ? "border-orange-400 bg-orange-50/80 ring-1 ring-orange-300/60"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="intent"
                    className="mt-1 accent-orange-600"
                    checked={intent === item.id}
                    onChange={() => setIntent(item.id)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-neutral-950">{item.title}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-neutral-600">{item.sub}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-neutral-900">¿Dónde buscas?</h3>
            <p className="mt-1 text-xs text-neutral-500">
              Provincia, municipio, barrio o código postal — puedes refinar después en el feed.
            </p>
            <div className="mt-2">
              <SpainLocationSearch
                value={query}
                onChange={setQuery}
                onPick={onPick}
                placeholder="Provincia, comarca, municipio, CP, distrito o barrio…"
                inputClassName="w-full rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 text-sm outline-none focus:border-neutral-300 focus:bg-white focus:ring-2 focus:ring-neutral-900/5"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-100 px-6 py-5">
          <button
            type="button"
            disabled={!canGo}
            onClick={go}
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3.5 text-sm font-semibold text-white shadow-md transition hover:from-orange-600 hover:to-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ver oportunidades ahora →
          </button>
          <Link
            href="/app/scan/nuevo"
            onClick={dismiss}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-neutral-200 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Completar radar con alertas
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="mt-3 w-full text-center text-xs text-neutral-400 hover:text-neutral-600"
          >
            Explorar sin configurar
          </button>
        </div>
      </div>
    </div>
  );
}
