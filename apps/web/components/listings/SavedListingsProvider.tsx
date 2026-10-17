"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Ctx = {
  savedIds: Set<string>;
  loading: boolean;
  needsAuth: boolean;
  refresh: () => Promise<void>;
  isSaved: (id: string) => boolean;
  setSavedLocal: (id: string, saved: boolean) => void;
};

const SavedCtx = createContext<Ctx | null>(null);

export function SavedListingsProvider({ children }: { children: React.ReactNode }) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saved");
      if (res.status === 401) {
        setNeedsAuth(true);
        setSavedIds(new Set());
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { items?: { listing?: { id: string } }[] };
      const ids = new Set((data.items ?? []).map((i) => i.listing?.id).filter(Boolean) as string[]);
      setSavedIds(ids);
      setNeedsAuth(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setSavedLocal = useCallback((id: string, saved: boolean) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      savedIds,
      loading,
      needsAuth,
      refresh,
      isSaved: (id: string) => savedIds.has(id),
      setSavedLocal,
    }),
    [savedIds, loading, needsAuth, refresh, setSavedLocal]
  );

  return <SavedCtx.Provider value={value}>{children}</SavedCtx.Provider>;
}

export function useSavedListings() {
  const ctx = useContext(SavedCtx);
  if (!ctx) throw new Error("useSavedListings outside SavedListingsProvider");
  return ctx;
}
