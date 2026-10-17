"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Saved = {
  id: string;
  listing: { id: string; title: string; price: number; source_url: string };
};

export default function GuardadosPage() {
  const [items, setItems] = useState<Saved[]>([]);

  useEffect(() => {
    fetch("/api/saved")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Guardados</h1>
      {items.length === 0 && (
        <p className="mt-4 text-slate-400">Aún no has guardado oportunidades.</p>
      )}
      <ul className="mt-6 space-y-3">
        {items.map((s) => (
          <li key={s.id} className="rounded-lg border border-slate-800 p-4">
            <p>{s.listing.title}</p>
            <p className="text-sm text-slate-400">{s.listing.price.toLocaleString("es-ES")} €</p>
            <Link href={`/app/listings/${s.listing.id}`} className="text-sm text-emerald-400">
              Ver ficha
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
