"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type ResultRow = {
  rank: number;
  roi_gross: number;
  listing: {
    id: string;
    title: string | null;
    price: number;
    source_url: string;
    listing_investment?: { rent_est: number | null; rent_confidence: string | null };
  };
};

export default function ScanResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [status, setStatus] = useState("pending");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const s = await fetch(`/api/scans/${id}`);
      const scan = (await s.json()) as { status: string };
      if (!cancelled) setStatus(scan.status);
      const r = await fetch(`/api/scans/${id}/results`);
      const data = (await r.json()) as { results: ResultRow[] };
      if (!cancelled) setRows(data.results ?? []);
    }
    load();
    const t = setInterval(load, 2000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Resultados del scan</h1>
      <p className="text-sm text-slate-400">Estado: {status}</p>
      {rows.length === 0 && status === "completed" && (
        <p className="mt-4 text-slate-300">No hay oportunidades con estos filtros. Amplía zona o relaja precio.</p>
      )}
      <ul className="mt-6 space-y-3">
        {rows.map((row) => (
          <li
            key={row.listing.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 p-4"
          >
            <div>
              <p className="font-medium">{row.listing.title ?? "Inmueble"}</p>
              <p className="text-sm text-slate-400">
                {row.listing.price.toLocaleString("es-ES")} € · ROI {row.roi_gross.toFixed(2)} %
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/app/listings/${row.listing.id}`} className="text-sm text-emerald-400">
                Ficha
              </Link>
              <a
                href={row.listing.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline"
              >
                Ver anuncio
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
