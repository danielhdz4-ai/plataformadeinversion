"use client";

import { AppScrollPage } from "@/components/app/AppScrollPage";
import { SaveListingButton } from "@/components/listings/SaveListingButton";
import { decodeListingTitle } from "@/lib/decode-html";
import Link from "next/link";
import { useEffect, useState } from "react";

type Saved = {
  id: string;
  listing: {
    id: string;
    title: string;
    price: number;
    source_url: string;
  };
};

export default function GuardadosPage() {
  const [items, setItems] = useState<Saved[]>([]);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    fetch("/api/saved")
      .then((r) => {
        if (r.status === 401) {
          setNeedsAuth(true);
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d) setItems(d.items ?? []);
      });
  }, []);

  return (
    <AppScrollPage>
      <h1 className="text-2xl font-semibold text-neutral-950">Guardados</h1>
      <p className="mt-1 text-sm text-neutral-600">Oportunidades que marcaste para revisar más tarde.</p>

      {needsAuth && (
        <p className="mt-6 rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
          <Link href="/login" className="font-medium underline">
            Inicia sesión
          </Link>{" "}
          para ver y sincronizar tus guardados.
        </p>
      )}

      {!needsAuth && items.length === 0 && (
        <p className="mt-6 text-neutral-600">Aún no has guardado oportunidades. Usa «Guardar» en el mapa o en un scan.</p>
      )}

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {items.map((s) => (
          <li
            key={s.id}
            className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <div>
              <h2 className="line-clamp-2 font-medium capitalize text-neutral-950">
                {decodeListingTitle(s.listing.title)}
              </h2>
              <p className="mt-2 text-lg font-bold tabular-nums text-neutral-950">
                {s.listing.price.toLocaleString("es-ES")} €
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href={`/app/listings/${s.listing.id}`}
                className="rounded-md bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white"
              >
                Ver ficha
              </Link>
              <a
                href={s.listing.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-neutral-600 underline"
              >
                Anuncio original
              </a>
              <SaveListingButton listingId={s.listing.id} compact className="ml-auto" />
            </div>
          </li>
        ))}
      </ul>
    </AppScrollPage>
  );
}
