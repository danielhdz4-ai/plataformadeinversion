export type MapFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties?: Record<string, unknown>;
    geometry: unknown;
  }>;
};
