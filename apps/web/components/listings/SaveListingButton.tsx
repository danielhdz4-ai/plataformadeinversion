"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Props = {
  listingId: string;
  compact?: boolean;
  className?: string;
};

export function SaveListingButton({ listingId, compact, className = "" }: Props) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/saved");
      if (cancelled) return;
      if (res.status === 401) {
        setNeedsAuth(true);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { items?: { listing?: { id: string } }[] };
      const ids = new Set((data.items ?? []).map((i) => i.listing?.id).filter(Boolean));
      setSaved(ids.has(listingId));
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  const toggle = useCallback(async () => {
    if (needsAuth || saved) return;
    setLoading(true);
    try {
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      if (res.status === 401) {
        setNeedsAuth(true);
        return;
      }
      if (res.ok) setSaved(true);
    } finally {
      setLoading(false);
    }
  }, [listingId, needsAuth, saved]);

  if (needsAuth) {
    return (
      <Link
        href="/login"
        className={`inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 ${className}`}
      >
        {compact ? "Guardar" : "Inicia sesión para guardar"}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={loading || saved}
      onClick={(e) => {
        e.stopPropagation();
        void toggle();
      }}
      className={`inline-flex items-center justify-center rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-60 ${
        saved
          ? "border-neutral-950 bg-neutral-950 text-white"
          : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
      } ${className}`}
      aria-pressed={saved}
    >
      {loading ? "…" : saved ? "Guardado" : compact ? "Guardar" : "Guardar oportunidad"}
    </button>
  );
}
