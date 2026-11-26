"use client";

import type { ListingSummary } from "@/lib/listing/summary-types";
import { useEffect, useState } from "react";

async function fetchSummaries(
  ids: string[],
  mode: "whole" | "rooms",
  light: boolean
): Promise<Record<string, ListingSummary>> {
  if (ids.length === 0) return {};
  const res = await fetch("/api/listings/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: ids.slice(0, 60), mode, light }),
  });
  if (!res.ok) return {};
  const data = (await res.json()) as { summaries: Record<string, ListingSummary> };
  return data.summaries ?? {};
}

export function useListingSummaries(
  ids: string[],
  options?: { mode?: "whole" | "rooms"; detailId?: string | null }
) {
  const mode = options?.mode ?? "whole";
  const detailId = options?.detailId ?? null;
  const [summaries, setSummaries] = useState<Record<string, ListingSummary>>({});
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const key = ids.slice().sort().join(",");

  useEffect(() => {
    if (ids.length === 0) {
      setSummaries({});
      setListLoading(false);
      return;
    }
    let cancelled = false;
    setListLoading(true);
    (async () => {
      const batch = await fetchSummaries(ids, mode, true);
      if (cancelled) return;
      setSummaries((prev) => ({ ...prev, ...batch }));
      setListLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [key, ids, mode]);

  useEffect(() => {
    if (!detailId) {
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    (async () => {
      const batch = await fetchSummaries([detailId], mode, false);
      if (cancelled) return;
      setSummaries((prev) => ({ ...prev, ...batch }));
      setDetailLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [detailId, mode]);

  const waitingDetail =
    detailId != null && detailLoading && summaries[detailId] == null;
  const loading = listLoading || waitingDetail;

  return { summaries, loading, listLoading, detailLoading };
}
