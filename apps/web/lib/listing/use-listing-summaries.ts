"use client";

import type { ListingSummary } from "@/lib/listing/summary-types";
import { useEffect, useState } from "react";

export function useListingSummaries(ids: string[]) {
  const [summaries, setSummaries] = useState<Record<string, ListingSummary>>({});
  const [loading, setLoading] = useState(false);
  const key = ids.slice().sort().join(",");

  useEffect(() => {
    if (ids.length === 0) {
      setSummaries({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await fetch("/api/listings/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ids.slice(0, 60) }),
      });
      if (cancelled) return;
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { summaries: Record<string, ListingSummary> };
      if (!cancelled) {
        setSummaries(data.summaries ?? {});
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, ids]);

  return { summaries, loading };
}
