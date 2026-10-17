"use client";

import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import { DEFAULT_MAP } from "@/lib/scan/demo-polygon";

type Pin = { id: string; lng: number; lat: number; roi: number | null; price: number };

export function ExploreMap({
  pins,
  onBboxChange,
}: {
  pins: Pin[];
  onBboxChange?: (bbox: [number, number, number, number]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: DEFAULT_MAP.center,
      zoom: DEFAULT_MAP.zoom,
    });
    mapRef.current = map;

    const emitBbox = () => {
      const b = map.getBounds();
      onBboxChange?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    };
    map.on("moveend", emitBbox);
    emitBbox();

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onBboxChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sourceId = "pins";
    const geojson = {
      type: "FeatureCollection" as const,
      features: pins.map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] as [number, number] },
        properties: { id: p.id, roi: p.roi, price: p.price },
      })),
    };
    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson);
    } else {
      map.addSource(sourceId, { type: "geojson", data: geojson });
      map.addLayer({
        id: "pins-circle",
        type: "circle",
        source: sourceId,
        paint: {
          "circle-radius": 8,
          "circle-color": "#22c55e",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#052e16",
        },
      });
    }
  }, [pins]);

  return <div ref={containerRef} className="h-[420px] w-full rounded-xl border border-slate-800" />;
}
