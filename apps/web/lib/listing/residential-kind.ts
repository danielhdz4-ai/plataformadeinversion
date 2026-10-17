const BLOCKED = new Set(["garaje", "trastero", "local", "parking", "oficina", "nave", "terreno"]);

/** B8 — excluir tipologías no residenciales en mapa/scan buy-to-let. */
export function isResidentialPropertyKind(kind: string | null | undefined): boolean {
  if (!kind) return true;
  const k = kind.toLowerCase().trim();
  if (BLOCKED.has(k)) return false;
  if (k.includes("garaje") || k.includes("trastero") || k.includes("parking")) return false;
  return true;
}
