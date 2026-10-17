import type { ScanPolygon } from "@/lib/scan/types";

export function parseScanPolygon(raw: unknown): ScanPolygon | null {
  if (!raw) return null;
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as { type?: string; coordinates?: number[][][] };
  if (o.type !== "Polygon" || !Array.isArray(o.coordinates?.[0]) || o.coordinates[0].length < 3) {
    return null;
  }
  return { type: "Polygon", coordinates: o.coordinates };
}
