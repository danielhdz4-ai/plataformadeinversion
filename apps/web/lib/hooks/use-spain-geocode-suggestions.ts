"use client";

import type { GeocodeHit } from "@/lib/map/geocode-spain";
import { extractPostalFromQuery } from "@/lib/map/geocode-spain";
import { useEffect, useRef, useState } from "react";

export function useSpainGeocodeSuggestions(query: string, debounceMs = 320) {
  const [suggestions, setSuggestions] = useState<GeocodeHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    const onlyDigits = /^\d+$/.test(q);
    if (onlyDigits && q.length < 4) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    const t = setTimeout(async () => {
      const seq = ++seqRef.current;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
          signal: AbortSignal.timeout(12_000),
        });
        if (seq !== seqRef.current) return;
        if (!res.ok) {
          setSuggestions([]);
          setError("Búsqueda no disponible");
          return;
        }
        const data = (await res.json()) as { results?: GeocodeHit[] };
        setSuggestions(data.results ?? []);
      } catch {
        if (seq !== seqRef.current) return;
        setSuggestions([]);
        setError("Tiempo de espera agotado");
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(t);
  }, [query, debounceMs]);

  return { suggestions, loading, error, isCompleteCp: Boolean(extractPostalFromQuery(query.trim())) };
}
