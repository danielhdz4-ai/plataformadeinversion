/** ROI mostrable en UI — oculta el techo heurístico 7,8 % sin comparables de alquiler. */
export function grossRoiForDisplay(
  roiPct: number | null | undefined,
  rentConfidence: string | null | undefined,
  comparablesCount: number | null | undefined
): number | null {
  if (roiPct == null || !Number.isFinite(roiPct)) return null;
  const conf = String(rentConfidence ?? "").toLowerCase();
  const comps = comparablesCount ?? 0;
  if (comps < 2 && (conf === "low" || conf === "")) {
    if (Math.abs(roiPct - 7.8) < 0.2) return null;
  }
  return roiPct;
}
