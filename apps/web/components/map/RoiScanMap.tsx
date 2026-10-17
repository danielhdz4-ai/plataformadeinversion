"use client";

import type { ScanPolygon } from "@/lib/scan/types";
import { MapViewControls } from "@/components/map/MapViewControls";
import { polygonBounds } from "@/lib/map/polygon-bounds";
import { BARCELONA_VIEW, SPAIN_BBOX, SPAIN_MAX_BOUNDS, SPAIN_VIEW, type SpainMapView } from "@/lib/map/spain-bounds";
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
  rentConfidence?: string | null;
  geocodeQuality?: number | null;
};

type Props = {
  pins?: RoiPin[];
  drawMode?: boolean;
  polygon?: ScanPolygon | null;
  onPolygonChange?: (polygon: ScanPolygon | null) => void;
  onBboxChange?: (bbox: [number, number, number, number], meta?: { zoom: number }) => void;
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
  /** Encuadra el mapa cuando cambia el polígono de scan (resultados / geocodificar). */
  autoFitPolygon?: boolean;
  /** Encuadra según pins (p. ej. resultados del scan) si no hay polígono. */
  autoFitPins?: boolean;
  /** Encuadre explícito (prioridad sobre autoFit*). Cambia fitKey al cambiar scan/zona. */
  mapFitBounds?: [[number, number], [number, number]] | null;
  fitKey?: string;
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
  initialView = SPAIN_VIEW,
  autoFitPolygon = false,
  autoFitPins = false,
  mapFitBounds = null,
  fitKey = "",
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
  const wasDrawModeRef = useRef(false);
  const lastFitPolygonKeyRef = useRef<string | null>(null);
  const lastFitPinsKeyRef = useRef<string | null>(null);
  const lastExplicitFitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    drawModeRef.current = drawMode;
    const enteringDraw = drawMode && !wasDrawModeRef.current;
    wasDrawModeRef.current = drawMode;
    if (enteringDraw) {
      drawRingRef.current = [];
      const map = mapRef.current;
      if (map && mapReady) updateDrawLayer(map, [], false);
    }
  }, [drawMode, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (drawMode) {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
    }
  }, [drawMode, mapReady]);

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

    let bboxTimer: ReturnType<typeof setTimeout> | null = null;
    const emitBbox = (immediate = false) => {
      const z = map.getZoom();
      setZoom(z);
      const b = map.getBounds();
      const payload: [number, number, number, number] = [
        b.getWest(),
        b.getSouth(),
        b.getEast(),
        b.getNorth(),
      ];
      const fire = () => onBboxRef.current?.(payload, { zoom: z });
      if (immediate) {
        if (bboxTimer) clearTimeout(bboxTimer);
        fire();
        return;
      }
      if (bboxTimer) clearTimeout(bboxTimer);
      bboxTimer = setTimeout(fire, 300);
    };

    map.on("moveend", () => emitBbox(false));
    map.on("zoomend", () => emitBbox(false));
    map.once("load", () => {
      map.resize();
      setMapReady(true);
      emitBbox(true);
    });

    const ro = new ResizeObserver(() => {
      map.resize();
    });
    if (containerRef.current) ro.observe(containerRef.current);

    const onMapClick = (e: maplibregl.MapMouseEvent) => {
      if (!drawModeRef.current) return;
      if (polygonRef.current) return;
      const target = e.originalEvent.target as HTMLElement | null;
      if (target?.closest?.(".roi-pin, .map-view-controls, .map-draw-toolbar")) return;
      const { lng, lat } = e.lngLat;
      if (!isInSpain(lng, lat)) return;
      drawRingRef.current.push([lng, lat]);
      updateDrawLayer(map, drawRingRef.current, false);
    };

    const onMapDblClick = (e: maplibregl.MapMouseEvent) => {
      if (!drawModeRef.current) return;
      e.preventDefault();
      const ring = drawRingRef.current;
      if (ring.length < 3) return;
      const closed: ScanPolygon = {
        type: "Polygon",
        coordinates: [[...ring, ring[0]!]],
      };
      updateDrawLayer(map, ring, true);
      onPolyRef.current?.(closed);
    };

    map.on("click", onMapClick);
    map.on("dblclick", onMapDblClick);

    return () => {
      map.off("click", onMapClick);
      map.off("dblclick", onMapDblClick);
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
    map.flyTo({ center: flyTo.center, zoom: flyTo.zoom, essential: true, duration: 600 });
  }, [flyTo, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !mapFitBounds) return;
    const token = fitKey || JSON.stringify(mapFitBounds);
    if (lastExplicitFitKeyRef.current === token) return;
    lastExplicitFitKeyRef.current = token;
    map.fitBounds(mapFitBounds, { padding: 56, maxZoom: 15, duration: 0 });
  }, [mapFitBounds, mapReady, fitKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !autoFitPolygon || !polygon) return;
    const key = JSON.stringify(polygon.coordinates[0]);
    if (lastFitPolygonKeyRef.current === key) return;
    lastFitPolygonKeyRef.current = key;
    const bounds = polygonBounds(polygon);
    map.fitBounds(bounds, { padding: 56, maxZoom: 15, duration: 700 });
  }, [polygon, mapReady, autoFitPolygon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !autoFitPins || pins.length === 0) return;
    if (autoFitPolygon && polygon) return;
    const key = pins
      .map((p) => `${p.id}:${p.lng.toFixed(5)},${p.lat.toFixed(5)}`)
      .sort()
      .join("|");
    if (lastFitPinsKeyRef.current === key) return;
    lastFitPinsKeyRef.current = key;
    let minLng = pins[0]!.lng;
    let maxLng = pins[0]!.lng;
    let minLat = pins[0]!.lat;
    let maxLat = pins[0]!.lat;
    for (const p of pins) {
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
    }
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 56, maxZoom: 15, duration: 700 }
    );
  }, [pins, mapReady, autoFitPins, autoFitPolygon, polygon]);

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
    if (!map || !mapReady) return;
    if (!polygon) {
      if (!drawModeRef.current) updateDrawLayer(map, [], false);
      return;
    }
    if (drawModeRef.current && drawRingRef.current.length > 0 && drawRingRef.current.length < 3) {
      return;
    }
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
      const conf = (p.rentConfidence ?? "").toLowerCase();
      const confClass =
        conf === "high" || conf === "alta"
          ? " conf-high"
          : conf === "low" || conf === "baja"
            ? " conf-low"
            : conf
              ? " conf-med"
              : "";
      const approx =
        p.geocodeQuality != null && p.geocodeQuality >= 5 && zoom >= 14 ? " approx-geo" : "";
      el.className = `roi-pin${compact ? " compact" : ""}${confClass}${approx}${selectedId === p.id ? " selected" : ""}`;
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
        ev.preventDefault();
        onSelectRef.current?.(p.id);
      });
      el.addEventListener("mousedown", (ev) => ev.stopPropagation());
      el.addEventListener("dblclick", (ev) => ev.stopPropagation());
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
        <div className="map-draw-toolbar absolute bottom-4 left-4 flex max-w-lg flex-wrap gap-2">
          <button
            type="button"
            onClick={closePolygon}
            className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white shadow"
          >
            Cerrar zona
          </button>
          <button
            type="button"
            onClick={() => {
              drawRingRef.current = drawRingRef.current.slice(0, -1);
              const map = mapRef.current;
              if (map) updateDrawLayer(map, drawRingRef.current, false);
            }}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm shadow"
          >
            Deshacer punto
          </button>
          <button
            type="button"
            onClick={resetDraw}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm shadow"
          >
            Borrar
          </button>
          <span className="rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-600 shadow">
            Clic en el mapa = vértice · doble clic o «Cerrar zona» (mín. 3) · los pins se seleccionan sin dibujar
          </span>
        </div>
      )}
    </div>
  );
}
