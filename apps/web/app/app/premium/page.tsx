import { AppScrollPage } from "@/components/app/AppScrollPage";
import Link from "next/link";

const FEATURES = [
  "Escaneos ilimitados y alertas diarias/semanales",
  "Buy-to-let, habitaciones, Airbnb y rent-to-rent",
  "Análisis detallado con IA (Gemini): score, revalorización y reforma",
  "Data Lab España — exportación y comparables ampliados",
  "Calculadora pro e informes PDF",
];

export default function PremiumPage() {
  return (
    <AppScrollPage>
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Próximamente</p>
          <h1 className="mt-2 text-3xl font-bold text-neutral-950">Premium</h1>
          <p className="mt-2 text-neutral-600">
            Mientras tanto, el análisis IA con Gemini está <strong>abierto en beta</strong> para probar la experiencia
            completa.
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-500">Plan mensual (referencia ROI Explorer)</p>
          <p className="mt-1 text-4xl font-bold text-neutral-950">
            28 <span className="text-lg font-medium">€/mes</span>
          </p>
          <ul className="mt-6 space-y-2 text-sm text-neutral-800">
            {FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-emerald-600" aria-hidden>
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-neutral-500">
            Pagos con Stripe cuando activemos el corte. Variable{" "}
            <code className="rounded bg-neutral-100 px-1">NEXT_PUBLIC_AI_PREMIUM=1</code> activará el paywall de IA.
          </p>
          <Link
            href="/app/explorar"
            className="mt-6 inline-block w-full rounded-lg bg-neutral-950 py-3 text-center text-sm font-semibold text-white"
          >
            Seguir explorando (beta abierta)
          </Link>
        </div>
        <Link href="/app/scan/nuevo" className="text-sm font-medium text-neutral-700 underline">
          ← Nuevo scan ROI
        </Link>
      </div>
    </AppScrollPage>
  );
}
