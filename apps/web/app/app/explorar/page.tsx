"use client";

import {
  ListingDetailSidePanel,
  type SidePanelListing,
} from "@/components/listings/ListingDetailSidePanel";
import { PremiumListingCard } from "@/components/listings/PremiumListingCard";
import { pinFallbackListing } from "@/lib/listing/resolve-side-panel-listing";
import { useListingSummaries } from "@/lib/listing/use-listing-summaries";
import { CoverageLegend } from "@/components/map/CoverageLegend";
import { RoiScanMap } from "@/components/map/RoiScanMapLazy";
import { SPAIN_VIEW } from "@/lib/map/spain-bounds";
import { decodeListingTitle } from "@/lib/decode-html";
import { AppPanelHeader } from "@/components/app/AppPanelHeader";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

type ListingPin = {
  id: string;
  lng: number;
  lat: number;
  roi: number | null;
  price: number;
  source: string | null;
  title: string | null;
  sourceUrl: string | null;
  city?: string | null;
  thumbnailUrl?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqm?: number | null;
  rentEst?: number | null;
};

export default function ExplorarPage() {
  const [listings, setListings] = useState<ListingPin[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const loadMap = useCallback(async (bbox: [number, number, number, number]) => {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const res = await fetch(
      `/api/map/listings?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}`
    );
    if (!res.ok) return;
    const data = (await res.json()) as { features: ListingPin[] };
    setListings(data.features ?? []);
  }, []);


  const listingIds = useMemo(() => {
    const ids = listings.map((l) => l.id);
    if (selected && !ids.includes(selected)) ids.push(selected);
    return ids;
  }, [listings, selected]);
  const { summaries, loading: summariesLoading } = useListingSummaries(listingIds);

  const roiPins = useMemo(
    () =>
      listings.map((l) => ({
        id: l.id,
        lng: l.lng,
        lat: l.lat,
        roi: l.roi,
        price: l.price,
        rentEst: l.rentEst ?? null,
      })),
    [listings]
  );

  const selectedListing = useMemo((): SidePanelListing | null => {
    if (!selected) return null;
    const l = listings.find((x) => x.id === selected);
    if (l) {
      return {
        id: l.id,
        title: l.title,
        price: l.price,
        city: l.city,
        sourcePortal: l.source,
        thumbnailUrl: l.thumbnailUrl,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        sqm: l.sqm,
        roi: l.roi,
        rentEst: l.rentEst ?? null,
        sourceUrl: l.sourceUrl,
      };
    }
    const pin = roiPins.find((p) => p.id === selected);
    if (pin) return pinFallbackListing(selected, pin);
    return null;
  }, [selected, listings, roiPins]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <aside className="flex min-h-0 w-full shrink-0 flex-col border-r border-neutral-200 bg-[#f7f6f3] lg:w-[min(380px,34vw)]">
        <AppPanelHeader
          title="Explorar mercado"
          subtitle={`${listings.length} ventas activas · kelify + pisos.com`}
          action={
            <Link
              href="/app/scan/nuevo"
              className="inline-block rounded bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white"
            >
              Nuevo scan ROI
            </Link>
          }
        />
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          {listings.length === 0 && (
            <p className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
              Acerca el mapa a una ciudad con cobertura (leyenda abajo) o desplázate por España. Si no hay
              pins, estamos ampliando scrape en esa zona.
            </p>
          )}
          {listings.map((l) => (
            <PremiumListingCard
              key={l.id}
              listingId={l.id}
              title={decodeListingTitle(l.title ?? "Inmueble")}
              city={l.city}
              price={l.price}
              sourcePortal={l.source}
              thumbnailUrl={l.thumbnailUrl}
              bedrooms={l.bedrooms}
              bathrooms={l.bathrooms}
              sqm={l.sqm}
              roi={l.roi}
              rentEst={l.rentEst}
              sourceUrl={l.sourceUrl ?? undefined}
              selected={selected === l.id}
              onHover={() => setSelected(l.id)}
              onSelect={() => setSelected(l.id)}
              compact
              summary={summaries[l.id] ?? null}
              summaryLoading={summariesLoading}
            />
          ))}
        </div>
      </aside>
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <CoverageLegend className="absolute bottom-3 left-3 z-10 max-w-[min(100%-1.5rem,28rem)]" />
        <RoiScanMap
          pins={roiPins}
          selectedId={selected}
          onSelectPin={setSelected}
          onBboxChange={loadMap}
          initialView={SPAIN_VIEW}
          maxPins={64}
          className="absolute inset-0 h-full w-full"
        />
      </div>
      {selected && selectedListing && (
        <button
          type="button"
          aria-label="Cerrar panel"
          className="fixed inset-0 z-30 bg-black/25 xl:hidden"
          onClick={() => setSelected(null)}
        />
      )}
      <ListingDetailSidePanel
        listing={selectedListing}
        summary={selected ? (summaries[selected] ?? null) : null}
        summaryLoading={summariesLoading}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
