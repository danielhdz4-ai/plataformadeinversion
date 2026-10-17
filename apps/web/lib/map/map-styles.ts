import type { StyleSpecification } from "maplibre-gl";

export type MapVisualMode = "2d" | "3d";
export type MapTheme = "claro" | "oscuro" | "satelite";

/** Estilos sin API key (CARTO exige clave desde 2024). */
const OPENFREEMAP = "https://tiles.openfreemap.org/styles";

export function mapStyleFor(theme: MapTheme): StyleSpecification | string {
  if (theme === "oscuro") {
    return `${OPENFREEMAP}/dark`;
  }
  if (theme === "satelite") {
    return {
      version: 8,
      sources: {
        base: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "© Esri",
        },
      },
      layers: [{ id: "base", type: "raster", source: "base" }],
    };
  }
  return `${OPENFREEMAP}/liberty`;
}
