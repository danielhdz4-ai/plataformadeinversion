"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`/api/listings/${id}`)
      .then((r) => r.json())
      .then(setData);
  }, [id]);

  if (!data) return <p className="p-8 text-slate-400">Cargando…</p>;
  const listing = data as {
    title: string;
    price: number;
    source_url: string;
    city: string;
    investment?: { rent_est: number; roi_gross: number; rent_confidence: string };
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/app/scan/nuevo" className="text-sm text-emerald-400">
        ← Scan
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">{listing.title}</h1>
      <p className="text-slate-300">{listing.city}</p>
      <p className="mt-2 text-xl">{Number(listing.price).toLocaleString("es-ES")} €</p>
      {listing.investment && (
        <div className="mt-6 rounded-lg border border-slate-800 p-4 text-sm">
          <p>Renta est.: {listing.investment.rent_est} €/mes</p>
          <p>ROI bruto: {listing.investment.roi_gross?.toFixed(2)} %</p>
          <p>Confianza: {listing.investment.rent_confidence}</p>
        </div>
      )}
      <a
        href={listing.source_url}
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-block rounded-lg bg-emerald-500 px-4 py-2 text-slate-950"
      >
        Ver anuncio original
      </a>
    </div>
  );
}
