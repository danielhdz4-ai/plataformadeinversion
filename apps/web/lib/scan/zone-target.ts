/** Ventas geolocalizadas mínimas en el polígono tras ingestión on-demand (alineado con SCAN_TARGET_IN_POLYGON). */
export const SCAN_ZONE_TARGET_IN_POLYGON = Number(
  process.env.SCAN_TARGET_IN_POLYGON ?? "180"
);

/** Por debajo de esto mostramos aviso suave en resultados (no bloquea el scan). */
export const SCAN_ZONE_SOFT_WARN_BELOW = Math.min(
  100,
  Math.floor(SCAN_ZONE_TARGET_IN_POLYGON * 0.55)
);
