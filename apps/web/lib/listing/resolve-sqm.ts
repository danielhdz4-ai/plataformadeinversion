/** Superficie útil: BD o texto del anuncio (85 m², 60m2, …). */
export function resolveListingSqm(
  sqm: number | null | undefined,
  title: string | null | undefined
): number | null {
  if (sqm != null && Number.isFinite(sqm) && sqm > 8 && sqm < 2500) {
    return Math.round(sqm * 10) / 10;
  }
  const t = (title ?? "").replace(/\s+/g, " ");
  const m = t.match(/(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:m²|m2|metros?\s*cuadrados?)/i);
  if (!m) return null;
  const n = Number.parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 8 || n >= 2500) return null;
  return Math.round(n * 10) / 10;
}
