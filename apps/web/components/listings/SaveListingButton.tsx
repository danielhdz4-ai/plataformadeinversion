"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useSavedListings } from "./SavedListingsProvider";

type Props = {
  listingId: string;
  compact?: boolean;
  className?: string;
};

export function SaveListingButton({ listingId, compact, className = "" }: Props) {
  const { isSaved, needsAuth, setSavedLocal } = useSavedListings();
  const saved = isSaved(listingId);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    if (needsAuth) return;
    setLoading(true);
    try {
      if (saved) {
        const res = await fetch(`/api/saved?listingId=${encodeURIComponent(listingId)}`, {
          method: "DELETE",
        });
        if (res.ok) setSavedLocal(listingId, false);
        return;
      }
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      if (res.ok) setSavedLocal(listingId, true);
    } finally {
      setLoading(false);
    }
  }, [listingId, needsAuth, saved, setSavedLocal]);

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
      disabled={loading}
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
      {loading ? "…" : saved ? (compact ? "Quitar" : "Guardado · quitar") : compact ? "Guardar" : "Guardar oportunidad"}
    </button>
  );
}
