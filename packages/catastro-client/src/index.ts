import { parseRcFromRccoordJson } from "./parse-rccoord.js";

const OVC_COORD =
  "http://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCoordenadas.svc/json";
const OVC_CALLEJERO =
  "http://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json";

export type CatastroBuildingHint = {
  rc: string;
  address?: string | null;
  surfaceM2?: number | null;
  yearBuilt?: number | null;
};

export async function fetchRcFromCoords(
  lon: number,
  lat: number
): Promise<string | null> {
  const url = `${OVC_COORD}/Consulta_RCCOOR?CoorX=${lon}&CoorY=${lat}&SRS=EPSG:4326`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  return parseRcFromRccoordJson(await res.json());
}

/** RC corta (14 chars) → datos no protegidos vía Consulta_DNPRC. */
export async function fetchBuildingFromRc(rc14: string): Promise<CatastroBuildingHint | null> {
  const ref = rc14.replace(/\s/g, "").slice(0, 14);
  if (ref.length < 14) return null;
  const url = `${OVC_CALLEJERO}/Consulta_DNPRC?RefCat=${encodeURIComponent(ref)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  const result = (data.Consulta_DNPRCResult ??
    data.consulta_dnprcResult ??
    data.consulta_dnprc) as Record<string, unknown> | undefined;
  const bico = result?.bico as Record<string, unknown> | undefined;
  const bi = (bico?.bi ?? result?.bi) as Record<string, unknown> | undefined;
  if (!bi) return { rc: ref };

  const ldt = (bi.ldt as string | undefined) ?? null;
  const debi = bi.debi as Record<string, unknown> | undefined;
  const surfaceM2 =
    debi?.sfc != null
      ? Number(debi.sfc)
      : debi?.sfccons != null
        ? Number(debi.sfccons)
        : null;
  const ant = debi?.ant != null ? Number(debi.ant) : null;
  const yearBuilt = ant != null && ant > 1800 && ant < 2100 ? ant : null;

  return { rc: ref, address: ldt, surfaceM2: Number.isFinite(surfaceM2!) ? surfaceM2 : null, yearBuilt };
}

export async function throttle(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
