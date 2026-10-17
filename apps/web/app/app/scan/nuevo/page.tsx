"use client";

import { ExploreMap } from "@/components/map/ExploreMap";
import { DEMO_POLYGON } from "@/lib/scan/demo-polygon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Pin = { id: string; lng: number; lat: number; roi: number | null; price: number };

export default function NewScanPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    priceMin: 100_000,
    priceMax: 350_000,
    bedroomsMin: 1,
  });

  const loadMap = useCallback(async (bbox: [number, number, number, number]) => {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const res = await fetch(
      `/api/map/listings?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}`
    );
    if (!res.ok) return;
    const data = (await res.json()) as { features: Pin[] };
    setPins(data.features ?? []);
  }, []);

  async function startScan() {
    setLoading(true);
    const res = await fetch("/api/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        polygon: DEMO_POLYGON,
        filters,
        operation: "buy_to_rent",
      }),
    });
    const body = (await res.json()) as { scanId?: string; error?: string };
    if (!res.ok || !body.scanId) {
      setLoading(false);
      alert(body.error ?? "Error al crear scan");
      return;
    }
    await fetch(`/api/scans/${body.scanId}/run`, { method: "POST" });
    setLoading(false);
    router.push(`/app/scan/${body.scanId}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-sm text-slate-400">Paso {step} de 3</p>
      {step === 1 && (
        <section className="space-y-4">
          <h1 className="text-2xl font-semibold">Zona de búsqueda</h1>
          <p className="text-slate-400">
            Explora el mapa. Para el MVP usamos el polígono demo La Barceloneta.
          </p>
          <ExploreMap pins={pins} onBboxChange={loadMap} />
          <button
            type="button"
            onClick={() => setStep(2)}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-slate-950"
          >
            Siguiente
          </button>
        </section>
      )}
      {step === 2 && (
        <section className="space-y-4">
          <h1 className="text-2xl font-semibold">Operación</h1>
          <p className="rounded-lg border border-emerald-800 bg-emerald-950/30 px-4 py-3">
            Comprar para alquilar
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(1)} className="rounded-lg border px-4 py-2">
              Atrás
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-slate-950"
            >
              Siguiente
            </button>
          </div>
        </section>
      )}
      {step === 3 && (
        <section className="space-y-4">
          <h1 className="text-2xl font-semibold">Filtros</h1>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              Precio min
              <input
                type="number"
                value={filters.priceMin}
                onChange={(e) => setFilters((f) => ({ ...f, priceMin: Number(e.target.value) }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
              />
            </label>
            <label className="text-sm">
              Precio max
              <input
                type="number"
                value={filters.priceMax}
                onChange={(e) => setFilters((f) => ({ ...f, priceMax: Number(e.target.value) }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
              />
            </label>
            <label className="text-sm">
              Dorm. mín.
              <input
                type="number"
                value={filters.bedroomsMin}
                onChange={(e) => setFilters((f) => ({ ...f, bedroomsMin: Number(e.target.value) }))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={startScan}
            className="rounded-lg bg-emerald-500 px-6 py-3 font-medium text-slate-950 disabled:opacity-50"
          >
            {loading ? "Buscando…" : "Buscar oportunidades"}
          </button>
        </section>
      )}
      <p className="mt-8 text-xs text-slate-500">
        <Link href="/">Volver al inicio</Link>
      </p>
    </div>
  );
}
