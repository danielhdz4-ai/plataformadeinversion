"use client";

import { ListingDetailFullView, type ListingDetailData } from "@/components/listings/ListingDetailFullView";
import type { ListingSummary } from "@/lib/listing/summary-types";
import {
  defaultReturnPath,
  returnNavLabel,
  sanitizeReturnPath,
} from "@/lib/listing/return-navigation";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

function ListingDetailPageContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const backHref = sanitizeReturnPath(searchParams.get("from")) ?? defaultReturnPath();
  const backLabel = returnNavLabel(backHref);
  const [data, setData] = useState<ListingDetailData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ListingSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    const res = await fetch(`/api/listings/${id}`);
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok || body.error) {
      setData(null);
      setLoadError(
        res.status === 404
          ? "Este inmueble no existe o ya no está activo."
          : String(body.error ?? "Error al cargar la ficha.")
      );
      return;
    }
    setData(body as unknown as ListingDetailData);
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    (async () => {
      const res = await fetch("/api/listings/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], light: false }),
      });
      if (cancelled) return;
      if (!res.ok) {
        setSummaryLoading(false);
        return;
      }
      const body = (await res.json()) as { summaries: Record<string, ListingSummary> };
      if (!cancelled) {
        setSummary(body.summaries?.[id] ?? null);
        setSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function enrichCatastro() {
    setEnriching(true);
    setEnrichError(null);
    const res = await fetch(`/api/listings/${id}/enrich`, { method: "POST" });
    const body = (await res.json()) as { error?: string };
    setEnriching(false);
    if (!res.ok) {
      setEnrichError(
        body.error ??
          (res.status === 400
            ? "Este anuncio no tiene ubicación en mapa (falta geolocalización)."
            : "No se pudo consultar Catastro. Inténtalo de nuevo.")
      );
      return;
    }
    void reload();
  }

  if (loadError) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-[#f4f3f0] p-8">
        <div className="max-w-md space-y-4 rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
          <p className="text-neutral-800">{loadError}</p>
          <Link href={backHref} className="text-sm font-medium text-neutral-950 underline">
            ← {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-[#f4f3f0] p-8 text-neutral-600">
        Cargando ficha…
      </div>
    );
  }

  return (
    <ListingDetailFullView
      listing={{ ...data, id }}
      summary={summary}
      summaryLoading={summaryLoading}
      backHref={backHref}
      backLabel={backLabel}
      onEnrichCatastro={enrichCatastro}
      enriching={enriching}
      enrichError={enrichError}
    />
  );
}

export default function ListingDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 items-center justify-center bg-[#f4f3f0] p-8 text-sm text-neutral-600">
          Cargando ficha…
        </div>
      }
    >
      <ListingDetailPageContent />
    </Suspense>
  );
}
