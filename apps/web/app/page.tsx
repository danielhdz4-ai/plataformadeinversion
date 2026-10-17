import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 px-6 py-16">
      <p className="text-sm uppercase tracking-widest text-emerald-400">ROI-first · España</p>
      <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
        Encuentra pisos con ROI defendible antes de comprar
      </h1>
      <p className="max-w-2xl text-lg text-slate-300">
        Dibuja una zona en el mapa, filtra oportunidades de compra y contrasta renta estimada con
        comparables y datos oficiales.
      </p>
      <div className="flex flex-wrap gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-emerald-500 px-6 py-3 font-medium text-slate-950 hover:bg-emerald-400"
        >
          Probar scan
        </Link>
        <Link
          href="/app/calculator"
          className="rounded-lg border border-slate-600 px-6 py-3 hover:border-slate-400"
        >
          Calculadora buy-to-let
        </Link>
      </div>
      <p className="text-xs text-slate-500">
        Información orientativa, no asesoramiento financiero, legal ni fiscal.
      </p>
    </main>
  );
}
