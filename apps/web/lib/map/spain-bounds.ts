/** Límites aproximados de España (península, Baleares y Canarias). */
export const SPAIN_BBOX = {
  minLng: -18.5,
  minLat: 27.5,
  maxLng: 4.5,
  maxLat: 43.8,
} as const;

/** Vista inicial — explorar toda España */
export const SPAIN_VIEW = {
  center: [-3.7, 40.2] as [number, number],
  zoom: 5.8,
};

export const SPAIN_MAX_BOUNDS: [[number, number], [number, number]] = [
  [SPAIN_BBOX.minLng, SPAIN_BBOX.minLat],
  [SPAIN_BBOX.maxLng, SPAIN_BBOX.maxLat],
];

/** Barcelona ciudad — vista scan por defecto */
export const BARCELONA_VIEW = {
  center: [2.1734, 41.3851] as [number, number],
  zoom: 12,
};

export type SpainMapView = typeof SPAIN_VIEW | typeof BARCELONA_VIEW;
