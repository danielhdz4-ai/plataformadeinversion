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
      <div className="brasa-card border-amber/30 bg-amber/10 p-3 text-xs text-ink">
        <p className="font-semibold">Análisis IA — Premium</p>
        <p className="mt-1 text-ink-muted">
          Revalorización, reforma estimada y scoring global con Gemini. De momento abierto en beta; luego incluido en
          Premium.
        </p>
        <Link href="/app/premium" className="mt-2 inline-block font-semibold text-lime underline">
          Ver planes
        </Link>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="brasa-card p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-lime">Análisis con IA</p>
        <p className="mt-1 text-xs text-ink-muted">
          Score global, revalorización prudente y rango de reforma con{" "}
          <span className="font-medium">Google Gemini</span> (datos del anuncio + ROI + notariado).
        </p>
        {error && <p className="mt-2 text-xs text-clay">{error}</p>}
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(true)}
          className="mt-2 rounded-full bg-lime px-3 py-1.5 text-xs font-bold text-lime-ink disabled:opacity-50"
        >
          {loading ? "Generando…" : compact ? "Generar análisis IA" : "Analizar con IA"}
        </button>
      </div>
    );
  }

  return (
    <div className="brasa-card space-y-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-lime">Análisis IA</p>
          <p className="mt-0.5 text-sm font-bold text-ink">{analysis.headline}</p>
        </div>
        <ScoreRing score={analysis.globalScore} />
      </div>
      <p className={`text-ink-muted ${compact ? "line-clamp-3 text-xs" : "text-sm"}`}>{analysis.summary}</p>
      {!compact && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <BulletList title="Fortalezas" items={analysis.strengths} tone="ok" />
            <BulletList title="Riesgos" items={analysis.risks} tone="warn" />
          </div>
          <dl className="grid gap-1 rounded-xl bg-raised/70 p-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-ink-muted">Revalorización est.</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {analysis.revaluation.annualPctEstimate > 0 ? "+" : ""}
                {analysis.revaluation.annualPctEstimate.toFixed(1)} %/año · {analysis.revaluation.horizonYears} años
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-muted">Reforma est.</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {analysis.renovation.estimateEurLow.toLocaleString("es-ES")} –{" "}
                {analysis.renovation.estimateEurHigh.toLocaleString("es-ES")} €
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-muted">Estrategia</dt>
              <dd className="font-semibold text-ink">{STRATEGY_LABEL[analysis.strategy]}</dd>
            </div>
          </dl>
          <p className="text-[10px] text-ink-muted">{analysis.strategyNote}</p>
          <p className="text-[10px] text-ink-muted/70">
            {meta.cached ? "Desde caché" : "Generado"} · {meta.model}
            {meta.generatedAt ? ` · ${new Date(meta.generatedAt).toLocaleString("es-ES")}` : ""}
          </p>
        </>
      )}
      {compact && (
        <p className="text-[10px] text-ink-muted">
          Score {analysis.globalScore}/100 · {STRATEGY_LABEL[analysis.strategy]}
        </p>
      )}
      <button
        type="button"
        disabled={loading}
        onClick={() => void load(true)}
        className="text-[10px] font-semibold text-ink-muted underline hover:text-lime disabled:opacity-50"
      >
        {loading ? "Actualizando…" : "Regenerar análisis"}
      </button>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div
      className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border-2 border-lime bg-lime/10 text-ink"
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
  const color = tone === "ok" ? "text-lime" : "text-amber";
  return (
    <div>
      <p className={`text-[10px] font-semibold uppercase ${color}`}>{title}</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-ink-muted">
        {items.slice(0, 4).map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

