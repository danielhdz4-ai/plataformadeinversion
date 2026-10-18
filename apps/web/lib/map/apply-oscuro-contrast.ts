import type { Map } from "maplibre-gl";

/** Ajusta OpenFreeMap «dark» hacia un carbón legible (estilo ROIExplorer). */
export function applyOscuroContrast(map: Map) {
  const style = map.getStyle();
  if (!style?.layers) return;

  const roadGrey = "#5a6270";
  const roadGreyLight = "#727b8a";
  const land = "#1e2128";
  const building = "#2a2f38";

  for (const layer of style.layers) {
    const id = layer.id;
    try {
      if (layer.type === "background") {
        map.setPaintProperty(id, "background-color", land);
        continue;
      }

      if (layer.type === "fill") {
        if (id === "building") {
          map.setPaintProperty(id, "fill-color", building);
        } else if (id.startsWith("landuse_") || id.startsWith("landcover_")) {
          map.setPaintProperty(id, "fill-color", land);
        }
        continue;
      }

      if (layer.type === "line") {
        if (id.includes("motorway") && id.includes("inner")) {
          map.setPaintProperty(id, "line-color", [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            "hsla(0,0%,72%,0.55)",
            10,
            roadGrey,
            14,
            roadGreyLight,
          ]);
        } else if (id.includes("highway") || id.includes("road")) {
          if (id.includes("casing") || id.includes("case")) {
            map.setPaintProperty(id, "line-color", "#3f4654");
          } else if (id.includes("minor") || id.includes("path") || id.includes("service")) {
            map.setPaintProperty(id, "line-color", "#454c58");
          } else {
            map.setPaintProperty(id, "line-color", roadGrey);
          }
        }
        continue;
      }

      if (layer.type === "symbol" && layer.layout?.["text-field"]) {
        map.setPaintProperty(id, "text-color", "#c4c8d0");
        map.setPaintProperty(id, "text-halo-color", "rgba(30,33,40,0.85)");
        map.setPaintProperty(id, "text-halo-width", 1.2);
      }
    } catch {
      /* capa sin propiedad editable */
    }
  }
}
