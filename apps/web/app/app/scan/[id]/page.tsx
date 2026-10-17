"use client";

import {
  ListingDetailSidePanel,
  type SidePanelListing,
} from "@/components/listings/ListingDetailSidePanel";
import { RoiScanMap } from "@/components/map/RoiScanMapLazy";
import { ResultListingCard } from "@/components/scan/ResultListingCard";
import { pinFallbackListing } from "@/lib/listing/resolve-side-panel-listing";
import { ScanProgressOverlay } from "@/components/scan/ScanProgressOverlay";
import { AppPanelHeader } from "@/components/app/AppPanelHeader";
import { ScanResultsToolbar } from "@/components/scan/ScanResultsToolbar";
import type { ScanPolygon } from "@/lib/scan/types";
import { useParams, useRouter } from "next/navigation";
import { useListingSummaries } from "@/lib/listing/use-listing-summaries";
import { useEffect, useMemo, useRef, useState } from "react";

type ResultRow = {
  rank: number;
  roi_gross: number;
  listing: {
    id: string;
    title: string | null;
    price: number;
    source_url: string;
    city?: string | null;
    source_portal?: string | null;
    thumbnail_url?: string | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    sqm?: number | null;
    listing_investment?: { rent_est: number | null; rent_confidence: string | null };
  };
};

type Pin = { id: string; lng: number; lat: number; roi: number | null; price: number };

export default function ScanResultsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [repeating, setRepeating] = useState(false);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [status, setStatus] = useState("pending");
  const [polygon, setPolygon] = useState<ScanPolygon | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mapCount, setMapCount] = useState(0);
  const [sort, setSort] = useState<"roi_desc" | "price_asc">("roi_desc");
  const [mapFallback, setMapFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const s = await fetch(`/api/scans/${id}`);
      const scan = (await s.json()) as { status: string; polygon?: ScanPolygon };
      if (!cancelled) {
        setStatus(scan.status);
        if (scan.polygon) setPolygon(scan.polygon);
      }
      const r = await fetch(`/api/scans/${id}/results`);
      const data = (await r.json()) as {
        results: ResultRow[];
        pins?: Pin[];
        mapCount?: number;
        usedMapFallback?: boolean;
      };
      if (!cancelled) {
        setRows(data.results ?? []);
        setPins(data.pins ?? []);
        setMapCount(data.mapCount ?? data.pins?.length ?? 0);
        setMapFallback(Boolean(data.usedMapFallback));
      }
    }
    load();
    const t = setInterval(load, status === "completed" ? 8000 : 2000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id, status]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    if (sort === "price_asc") copy.sort((a, b) => a.listing.price - b.listing.price);
    else copy.sort((a, b) => b.roi_gross - a.roi_gross);
    return copy;
  }, [rows, sort]);

  const listingIds = useMemo(() => {
    const ids = sortedRows.map((r) => r.listing.id);
    if (selected && !ids.includes(selected)) ids.push(selected);
    return ids;
  }, [sortedRows, selected]);
  const { summaries, loading: summariesLoading } = useListingSummaries(listingIds);

  const didInitialSelect = useRef(false);
  useEffect(() => {
    if (didInitialSelect.current || sortedRows.length === 0) return;
    didInitialSelect.current = true;
    setSelected(sortedRows[0]!.listing.id);
  }, [sortedRows]);

  const rentById = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const row of rows) {
      m.set(row.listing.id, row.listing.listing_investment?.rent_est ?? null);
    }
    return m;
  }, [rows]);

  const roiPins = useMemo(
    () =>
      pins.map((p) => ({
        ...p,
        rentEst: rentById.get(p.id) ?? null,
      })),
    [pins, rentById]
  );

  const selectedListing = useMemo((): SidePanelListing | null => {
    if (!selected) return null;
    const row = sortedRows.find((r) => r.listing.id === selected);
    if (row) {
      const l = row.listing;
      return {
        id: l.id,
        title: l.title,
        price: l.price,
        city: l.city,
        sourcePortal: l.source_portal,
        thumbnailUrl: l.thumbnail_url,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        sqm: l.sqm,
        roi: row.roi_gross,
        rentEst: l.listing_investment?.rent_est ?? null,
        sourceUrl: l.source_url,
        rank: row.rank,
      };
    }
    const pin = roiPins.find((p) => p.id === selected);
    if (pin) return pinFallbackListing(selected, pin);
    return null;
  }, [selected, sortedRows, roiPins]);

  const running = status !== "completed" && status !== "failed";
  const progressStep =
    status === "pending" ? 0 : status === "running" ? 1 : status === "ranking" ? 2 : 2;

  function exportJson() {
    const blob = new Blob([JSON.stringify({ scanId: id, results: sortedRows, pins }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `scan-${id.slice(0, 8)}.json`;
    a.click();
  }

  function csvCell(v: string | number | null | undefined) {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function exportCsv() {
    const header = "rank,roi_gross,price,bedrooms,sqm,city,title,url,id";
    const lines = sortedRows.map((r) => {
      const l = r.listing;
      return [
        r.rank,
        r.roi_gross.toFixed(2),
        l.price,
        l.bedrooms ?? "",
        l.sqm ?? "",
        l.city ?? "",
        l.title ?? "",
        l.source_url,
        l.id,
      ]
        .map(csvCell)
        .join(",");
    });
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `scan-${id.slice(0, 8)}.csv`;
    a.click();
  }

  async function repeatScan() {
    setRepeating(true);
    try {
      const res = await fetch(`/api/scans/${id}/repeat`, { method: "POST" });
      const data = (await res.json()) as { scanId?: string; error?: string };
      if (!res.ok || !data.scanId) {
        alert(data.error ?? "No se pudo repetir el scan");
        return;
      }
      router.push(`/app/scan/${data.scanId}`);
    } finally {
      setRepeating(false);
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ScanResultsToolbar
        scanId={id}
        sort={sort}
        onSortChange={setSort}
        onExportCsv={exportCsv}
        onExportJson={exportJson}
        onRepeat={() => void repeatScan()}
        repeating={repeating}
      />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {running && <ScanProgressOverlay activeStep={progressStep} />}
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-r border-neutral-200 bg-[#f7f6f3] lg:w-[min(380px,34vw)]">
          <AppPanelHeader
            title="Resultados del scan"
            subtitle={`${sortedRows.length} ranking · ${mapCount} pisos en mapa (kelify + pisos.com)`}
          />
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
            {mapFallback && sortedRows.length > 0 && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                Ningún piso pasó los filtros del scan (precio máx., dorm.). Mostramos los del mapa en esta
                zona para que puedas revisarlos o repetir el scan con filtros más amplios.
              </p>
            )}
            {sortedRows.length === 0 && status === "completed" && (
              <p className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
                Sin resultados. Amplía la zona o sube el precio máximo.
              </p>
            )}
            {sortedRows.map((row) => (
              <ResultListingCard
                key={row.listing.id}
                title={row.listing.title ?? "Inmueble"}
                price={row.listing.price}
                roi={row.roi_gross}
                rentEst={row.listing.listing_investment?.rent_est}
                sourceUrl={row.listing.source_url}
                listingId={row.listing.id}
                sourcePortal={row.listing.source_portal}
                thumbnailUrl={row.listing.thumbnail_url}
                bedrooms={row.listing.bedrooms}
                bathrooms={row.listing.bathrooms}
                sqm={row.listing.sqm}
                city={row.listing.city}
                selected={selected === row.listing.id}
                onHover={() => setSelected(row.listing.id)}
                onSelect={() => setSelected(row.listing.id)}
                compact
                summary={summaries[row.listing.id] ?? null}
                summaryLoading={summariesLoading}
              />
            ))}
          </div>
        </aside>
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-neutral-100">
          <RoiScanMap
            pins={roiPins}
            polygon={polygon}
            selectedId={selected}
            onSelectPin={setSelected}
            maxPins={72}
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
    </div>
  );
}
