type PcPair = { pc1?: string; pc2?: string };

/** Normaliza respuesta JSON WCF Catastro (Consulta_RCCOOR). */
export function parseRcFromRccoordJson(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const result =
    (root.Consulta_RCCOORResult as Record<string, unknown> | undefined) ??
    (root.consulta_coordenadas as Record<string, unknown> | undefined);
  if (!result) return null;

  const coordenadas = result.coordenadas as Record<string, unknown> | undefined;
  if (!coordenadas) return null;

  let coord = coordenadas.coord;
  if (!coord) return null;
  const list = Array.isArray(coord) ? coord : [coord];
  const first = list[0] as Record<string, unknown> | undefined;
  if (!first) return null;

  const pc = (first.pc ?? (first.coord as Record<string, unknown> | undefined)?.pc) as PcPair | undefined;
  if (!pc?.pc1 || !pc?.pc2) return null;
  return `${pc.pc1}${pc.pc2}`.replace(/\s/g, "");
}
