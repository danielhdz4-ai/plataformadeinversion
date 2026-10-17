/** La Barceloneta — preset demo (GeoJSON Polygon) */
export const DEMO_POLYGON = {
  type: "Polygon" as const,
  coordinates: [
    [
      [2.188, 41.375],
      [2.198, 41.375],
      [2.198, 41.382],
      [2.188, 41.382],
      [2.188, 41.375],
    ],
  ],
};

export { BARCELONA_VIEW as DEFAULT_MAP } from "@/lib/map/spain-bounds";
