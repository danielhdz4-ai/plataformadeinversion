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
import { portalBadge } from "@/lib/portals";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  rentConfidence?: string | null;
  geocodeQuality?: number | null;
};

function ExplorarPageContent() {
  const searchParams = useSearchParams();
  const [listings, setListings] = useState<ListingPin[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const lastBboxRef = useRef<[number, number, number, number] | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [summaryMode, setSummaryMode] = useState<"whole" | "rooms">("whole");

  useEffect(() => {
    const lid = searchParams.get("listing");
    if (lid) setSelected(lid);
  }, [searchParams]);

  const explorarReturnTo = useMemo(
    () => (selected ? `/app/explorar?listing=${selected}` : "/app/explorar"),
    [selected]
  );

  const loadMap = useCallback(async (bbox: [number, number, number, number], meta?: { zoom: number }) => {
    lastBboxRef.current = bbox;
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const zoomQ = meta?.zoom != null ? `&zoom=${meta.zoom}` : "";
    const res = await fetch(
      `/api/map/listings?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}${zoomQ}`
    );
    if (!res.ok) return;
    const data = (await res.json()) as { features: ListingPin[] };
    setListings(data.features ?? []);
  }, []);

  const portalSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of listings) {
      const key = l.source ?? "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const parts = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([key, n]) => `${portalBadge(key).name} ${n}`);
    return parts.length > 0 ? parts.join(" · ") : null;
  }, [listings]);

  async function requestCoverage() {
    const bbox = lastBboxRef.current;
    if (!bbox) return;
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const res = await fetch("/api/map/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minLng, minLat, maxLng, maxLat, note: "Explorar sin pins" }),
    });
    if (res.ok) setRequestSent(true);
  }

  const listingIds = useMemo(() => {
    const ids = listings.map((l) => l.id);
    if (selected && !ids.includes(selected)) ids.push(selected);
    return ids;
  }, [listings, selected]);
  const { summaries, loading: summariesLoading } = useListingSummaries(listingIds, {
    mode: summaryMode,
  });

  const roiPins = useMemo(
    () =>
      listings.map((l) => ({
        id: l.id,
        lng: l.lng,
        lat: l.lat,
        roi: l.roi,
        price: l.price,
        rentEst: l.rentEst ?? null,
        rentConfidence: l.rentConfidence ?? null,
        geocodeQuality: l.geocodeQuality ?? null,
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
          subtitle={
            listings.length === 0
              ? "Acerca el mapa a una ciudad con cobertura"
              : `${listings.length} ventas activas${portalSummary ? ` · ${portalSummary}` : ""}`
          }
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
            <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
              <p>
                Acerca el mapa a una ciudad con cobertura (leyenda abajo) o desplázate por España. Si no hay
                pins, estamos ampliando scrape en esa zona.
              </p>
              <button
                type="button"
                disabled={requestSent}
                onClick={() => void requestCoverage()}
                className="mt-3 rounded-lg border border-neutral-950 bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {requestSent ? "Solicitud enviada" : "Solicitar datos en esta zona"}
              </button>
            </div>
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
              returnTo={explorarReturnTo}
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
        summaryMode={summaryMode}
        onSummaryModeChange={setSummaryMode}
        listing={selectedListing}
        summary={selected ? (summaries[selected] ?? null) : null}
        summaryLoading={summariesLoading}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

export default function ExplorarPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center p-8 text-sm text-neutral-600">Cargando explorar…</div>}>
      <ExplorarPageContent />
    </Suspense>
  );
}
