"use client";

import type { ListingAiAnalysis, ListingAiAnalysisResponse } from "@/lib/ai/listing-analysis-types";
import { isAiPremiumGated } from "@/lib/platform/features";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const STRATEGY_LABEL: Record<ListingAiAnalysis["strategy"], string> = {
  buy_to_let: "Buy-to-let",
  airbnb: "Airbnb / vacacional",
  flip: "Flipping",
  hold: "Comprar y mantener",
  pass: "Pasar oportunidad",
};

type Props = {
  listingId: string;
  /** En tarjetas: no auto-cargar (coste API). En ficha: puede precargar cache. */
  compact?: boolean;
  autoLoadCache?: boolean;
};

export function ListingAiAnalysisBlock({ listingId, compact = false, autoLoadCache = false }: Props) {
  const [analysis, setAnalysis] = useState<ListingAiAnalysis | null>(null);
  const [meta, setMeta] = useState<{ model?: string; generatedAt?: string; cached?: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);

  const load = useCallback(
    async (generate: boolean) => {
      setLoading(true);
      setError(null);
      setPremiumRequired(false);
      try {
        if (!generate && autoLoadCache) {
          const getRes = await fetch(`/api/listings/${listingId}/ai-analysis`);
          if (getRes.status === 402) {
            setPremiumRequired(true);
            return;
          }
          if (getRes.ok) {
            const data = (await getRes.json()) as ListingAiAnalysisResponse & { analysis?: ListingAiAnalysis | null };
            if (data.analysis) {
              setAnalysis(data.analysis);
              setMeta({ model: data.model, generatedAt: data.generatedAt, cached: data.cached });
              return;
            }
          }
        }
        if (!generate) return;

        const postRes = await fetch(`/api/listings/${listingId}/ai-analysis`, { method: "POST" });
        if (postRes.status === 402) {
          setPremiumRequired(true);
          return;
        }
        if (!postRes.ok) {
          const err = (await postRes.json()) as { error?: string };
          if (postRes.status === 503 && err.error?.includes("GEMINI_API_KEY")) {
            setError("Análisis IA no disponible: falta GEMINI_API_KEY en Vercel (Settings → Environment Variables).");
            return;
          }
          throw new Error(err.error ?? `Error ${postRes.status}`);
        }
        const data = (await postRes.json()) as ListingAiAnalysisResponse;
        setAnalysis(data.analysis);
        setMeta({ model: data.model, generatedAt: data.generatedAt, cached: data.cached });
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo generar el análisis");
      } finally {
        setLoading(false);
      }
    },
    [listingId, autoLoadCache]
  );

  useEffect(() => {
    if (autoLoadCache) void load(false);
  }, [autoLoadCache, load]);

  if (premiumRequired || (isAiPremiumGated() && !analysis)) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950">
        <p className="font-semibold">Análisis IA — Premium</p>
        <p className="mt-1 text-amber-900/90">
          Revalorización, reforma estimada y scoring global con Gemini. De momento abierto en beta; luego incluido en
          Premium.
        </p>
        <Link href="/app/premium" className="mt-2 inline-block font-medium underline">
          Ver planes
        </Link>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">Análisis con IA</p>
        <p className="mt-1 text-xs text-neutral-700">
          Score global, revalorización prudente y rango de reforma con{" "}
          <span className="font-medium">Google Gemini</span> (datos del anuncio + ROI + notariado).
        </p>
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(true)}
          className="mt-2 rounded-md bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {loading ? "Generando…" : compact ? "Generar análisis IA" : "Analizar con IA"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-violet-200/80 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">Análisis IA</p>
          <p className="mt-0.5 text-sm font-semibold text-neutral-950">{analysis.headline}</p>
        </div>
        <ScoreRing score={analysis.globalScore} />
      </div>
      <p className={`text-neutral-700 ${compact ? "line-clamp-3 text-xs" : "text-sm"}`}>{analysis.summary}</p>
      {!compact && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <BulletList title="Fortalezas" items={analysis.strengths} tone="ok" />
            <BulletList title="Riesgos" items={analysis.risks} tone="warn" />
          </div>
          <dl className="grid gap-1 rounded border border-neutral-100 bg-[#faf9f7] p-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-600">Revalorización est.</dt>
              <dd className="font-medium tabular-nums">
                {analysis.revaluation.annualPctEstimate > 0 ? "+" : ""}
                {analysis.revaluation.annualPctEstimate.toFixed(1)} %/año · {analysis.revaluation.horizonYears} años
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-600">Reforma est.</dt>
              <dd className="font-medium tabular-nums">
                {analysis.renovation.estimateEurLow.toLocaleString("es-ES")} –{" "}
                {analysis.renovation.estimateEurHigh.toLocaleString("es-ES")} €
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-neutral-600">Estrategia</dt>
              <dd className="font-medium">{STRATEGY_LABEL[analysis.strategy]}</dd>
            </div>
          </dl>
          <p className="text-[10px] text-neutral-500">{analysis.strategyNote}</p>
          <p className="text-[10px] text-neutral-400">
            {meta.cached ? "Desde caché" : "Generado"} · {meta.model}
            {meta.generatedAt ? ` · ${new Date(meta.generatedAt).toLocaleString("es-ES")}` : ""}
          </p>
        </>
      )}
      {compact && (
        <p className="text-[10px] text-neutral-500">
          Score {analysis.globalScore}/100 · {STRATEGY_LABEL[analysis.strategy]}
        </p>
      )}
      <button
        type="button"
        disabled={loading}
        onClick={() => void load(true)}
        className="text-[10px] font-medium text-neutral-600 underline disabled:opacity-50"
      >
        {loading ? "Actualizando…" : "Regenerar análisis"}
      </button>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div
      className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border-2 border-violet-600 bg-violet-50 text-violet-950"
      title="Score global"
    >
      <span className="text-sm font-bold leading-none">{Math.round(score)}</span>
      <span className="text-[8px] uppercase">/100</span>
    </div>
  );
}

function BulletList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "ok" | "warn";
}) {
  const color = tone === "ok" ? "text-emerald-800" : "text-amber-900";
  return (
    <div>
      <p className={`text-[10px] font-semibold uppercase ${color}`}>{title}</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-neutral-700">
        {items.slice(0, 4).map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
