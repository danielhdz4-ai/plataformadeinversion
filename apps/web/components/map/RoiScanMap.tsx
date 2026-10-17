"use client";

import type { ScanPolygon } from "@/lib/scan/types";
import { MapViewControls } from "@/components/map/MapViewControls";
import { BARCELONA_VIEW, SPAIN_BBOX, SPAIN_MAX_BOUNDS, type SpainMapView } from "@/lib/map/spain-bounds";
import { layoutMapPins } from "@/lib/map/layout-map-pins";
import { mapStyleFor, type MapTheme, type MapVisualMode } from "@/lib/map/map-styles";
import maplibregl from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";

export type RoiPin = {
  id: string;
  lng: number;
  lat: number;
  roi: number | null;
  price: number;
  rentEst?: number | null;
};

type Props = {
  pins?: RoiPin[];
  drawMode?: boolean;
  polygon?: ScanPolygon | null;
  onPolygonChange?: (polygon: ScanPolygon | null) => void;
  onBboxChange?: (bbox: [number, number, number, number]) => void;
  selectedId?: string | null;
  onSelectPin?: (id: string) => void;
  className?: string;
  /** Centra el mapa (p. ej. tras geocodificar en España). */
  flyTo?: { center: [number, number]; zoom: number } | null;
  showViewControls?: boolean;
  maxPins?: number;
  /** Estilo visual del área de búsqueda (círculo azul vs polígono dibujado). */
  zoneVisual?: "radius" | "drawn";
  centerMarker?: { lng: number; lat: number } | null;
  /** Vista al crear el mapa (explorar = España; scan = Barcelona por defecto). */
  initialView?: SpainMapView;
};

function isInSpain(lng: number, lat: number) {
  return (
    lng >= SPAIN_BBOX.minLng &&
    lng <= SPAIN_BBOX.maxLng &&
    lat >= SPAIN_BBOX.minLat &&
    lat <= SPAIN_BBOX.maxLat
  );
}

const POLY_SOURCE = "scan-polygon";

export function RoiScanMap({
  pins = [],
  drawMode = false,
  polygon,
  onPolygonChange,
  onBboxChange,
  selectedId,
  onSelectPin,
  className = "h-full w-full",
  flyTo,
  showViewControls = true,
  maxPins = 120,
  zoneVisual = "radius",
  centerMarker = null,
  initialView = BARCELONA_VIEW,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const centerMarkerRef = useRef<maplibregl.Marker | null>(null);
  const zoneVisualRef = useRef(zoneVisual);
  const drawRingRef = useRef<[number, number][]>([]);
  const polygonRef = useRef(polygon);
  const drawModeRef = useRef(drawMode);
  const [mapReady, setMapReady] = useState(false);
  const [zoom, setZoom] = useState(BARCELONA_VIEW.zoom);
  const [theme, setTheme] = useState<MapTheme>("claro");
  const [visual, setVisual] = useState<MapVisualMode>("2d");
  const themeAppliedOnce = useRef(false);

  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);

  useEffect(() => {
    zoneVisualRef.current = zoneVisual;
  }, [zoneVisual]);

  const displayPins = useMemo(
    () => layoutMapPins(pins, { max: maxPins, zoom }),
    [pins, maxPins, zoom]
  );

  useEffect(() => {
    polygonRef.current = polygon;
  }, [polygon]);
  const onBboxRef = useRef(onBboxChange);
  const onPolyRef = useRef(onPolygonChange);
  const onSelectRef = useRef(onSelectPin);

  useEffect(() => {
    onBboxRef.current = onBboxChange;
    onPolyRef.current = onPolygonChange;
    onSelectRef.current = onSelectPin;
  }, [onBboxChange, onPolygonChange, onSelectPin]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyleFor("claro"),
      center: initialView.center,
      zoom: initialView.zoom,
      maxBounds: SPAIN_MAX_BOUNDS,
      minZoom: 4.5,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const emitBbox = () => {
      setZoom(map.getZoom());
      const b = map.getBounds();
      onBboxRef.current?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    };

    map.on("moveend", emitBbox);
    map.on("zoomend", emitBbox);
    map.once("load", () => {
      map.resize();
      setMapReady(true);
      emitBbox();
    });

    const ro = new ResizeObserver(() => {
      map.resize();
    });
    if (containerRef.current) ro.observe(containerRef.current);

    map.on("click", (e) => {
      if (!drawModeRef.current) return;
      const { lng, lat } = e.lngLat;
      if (!isInSpain(lng, lat)) return;
      drawRingRef.current.push([lng, lat]);
      updateDrawLayer(map, drawRingRef.current, false);
    });

    return () => {
      ro.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!themeAppliedOnce.current) {
      themeAppliedOnce.current = true;
      return;
    }
    setMapReady(false);
    map.setStyle(mapStyleFor(theme));
    map.once("idle", () => {
      map.resize();
      const poly = polygonRef.current;
      if (poly) {
        const ring = poly.coordinates[0]!.slice(0, -1) as [number, number][];
        drawRingRef.current = ring;
        updateDrawLayer(map, ring, true);
      }
      setZoom(map.getZoom());
      setMapReady(true);
    });
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.easeTo({
      pitch: visual === "3d" ? 52 : 0,
      bearing: visual === "3d" ? -24 : 0,
      duration: 600,
    });
  }, [visual, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !flyTo) return;
    map.flyTo({ center: flyTo.center, zoom: flyTo.zoom, essential: true });
  }, [flyTo, mapReady]);

  function updateDrawLayer(map: maplibregl.Map, ring: [number, number][], closed: boolean) {
    const geojson =
      ring.length === 0
        ? { type: "FeatureCollection", features: [] }
        : closed && ring.length >= 3
          ? {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  geometry: { type: "Polygon", coordinates: [[...ring, ring[0]!]] },
                  properties: {},
                },
              ],
            }
          : {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  geometry: { type: "LineString", coordinates: ring },
                  properties: {},
                },
              ],
            };

    const radius = zoneVisualRef.current === "radius";
    if (map.getSource(POLY_SOURCE)) {
      (map.getSource(POLY_SOURCE) as maplibregl.GeoJSONSource).setData(geojson);
      if (map.getLayer(`${POLY_SOURCE}-fill`)) {
        map.setPaintProperty(`${POLY_SOURCE}-fill`, "fill-color", radius ? "#2563eb" : "#0a0a0a");
        map.setPaintProperty(`${POLY_SOURCE}-fill`, "fill-opacity", radius ? 0.14 : 0.12);
        map.setPaintProperty(`${POLY_SOURCE}-line`, "line-color", radius ? "#1d4ed8" : "#0a0a0a");
        map.setPaintProperty(`${POLY_SOURCE}-line`, "line-width", radius ? 2.5 : 2);
      }
    } else {
      map.addSource(POLY_SOURCE, { type: "geojson", data: geojson });
      map.addLayer({
        id: `${POLY_SOURCE}-fill`,
        type: "fill",
        source: POLY_SOURCE,
        paint: {
          "fill-color": radius ? "#2563eb" : "#0a0a0a",
          "fill-opacity": radius ? 0.14 : 0.12,
        },
        filter: ["==", ["geometry-type"], "Polygon"],
      });
      map.addLayer({
        id: `${POLY_SOURCE}-line`,
        type: "line",
        source: POLY_SOURCE,
        paint: {
          "line-color": radius ? "#1d4ed8" : "#0a0a0a",
          "line-width": radius ? 2.5 : 2,
        },
      });
    }
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !polygon) return;
    const ring = polygon.coordinates[0]!.slice(0, -1) as [number, number][];
    drawRingRef.current = ring;
    updateDrawLayer(map, ring, true);
  }, [polygon, mapReady, zoneVisual]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      return;
    }
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const compact = zoom < 13;
    for (const p of displayPins) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `roi-pin${compact ? " compact" : ""}${selectedId === p.id ? " selected" : ""}`;
      const roi = p.roi != null ? `${p.roi.toFixed(1)}%` : "—";
      const rent =
        !compact && p.rentEst ? ` · ${Math.round(p.rentEst)}€` : "";
      el.textContent = compact ? roi : `${roi} ROI${rent}`;
      el.title =
        p.roi != null
          ? `${p.roi.toFixed(1)}% ROI${p.rentEst ? ` · ${Math.round(p.rentEst)}€/mes` : ""}`
          : "Sin ROI";
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onSelectRef.current?.(p.id);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [displayPins, mapReady, selectedId, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    centerMarkerRef.current?.remove();
    centerMarkerRef.current = null;
    if (!centerMarker) return;
    const el = document.createElement("div");
    el.className = "h-4 w-4 rounded-full border-2 border-white bg-neutral-950 shadow-md";
    centerMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([centerMarker.lng, centerMarker.lat])
      .addTo(map);
    return () => {
      centerMarkerRef.current?.remove();
      centerMarkerRef.current = null;
    };
  }, [centerMarker, mapReady]);

  function closePolygon() {
    const map = mapRef.current;
    const ring = drawRingRef.current;
    if (!map || ring.length < 3) return;
    const closed: ScanPolygon = {
      type: "Polygon",
      coordinates: [[...ring, ring[0]!]],
    };
    updateDrawLayer(map, ring, true);
    onPolyRef.current?.(closed);
  }

  function resetDraw() {
    drawRingRef.current = [];
    const map = mapRef.current;
    if (map) updateDrawLayer(map, [], false);
    onPolyRef.current?.(null);
  }

  return (
    <div className={`relative h-full min-h-0 ${className}`}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full bg-neutral-200" />
      {showViewControls && (
        <MapViewControls theme={theme} visual={visual} onTheme={setTheme} onVisual={setVisual} />
      )}
      {drawMode && (
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={closePolygon}
            className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white shadow"
          >
            Cerrar zona
          </button>
          <button
            type="button"
            onClick={resetDraw}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm shadow"
          >
            Borrar
          </button>
          <span className="rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-600 shadow">
            Solo España: dibuja el polígono sobre el mapa
          </span>
        </div>
      )}
    </div>
  );
}
