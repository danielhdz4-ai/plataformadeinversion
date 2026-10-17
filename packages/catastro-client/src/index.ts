const OVC_BASE =
  "http://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCoordenadas.svc/json";

export async function fetchRcFromCoords(
  lon: number,
  lat: number
): Promise<string | null> {
  const url = `${OVC_BASE}/Consulta_RCCOOR?CoorX=${lon}&CoorY=${lat}&SRS=EPSG:4326`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    consulta_coordenadas?: { coordenadas?: { coord?: { pc?: { pc1?: string; pc2?: string } } }[] };
  };
  const pc = data.consulta_coordenadas?.coordenadas?.[0]?.coord?.pc;
  if (!pc?.pc1 || !pc?.pc2) return null;
  return `${pc.pc1}${pc.pc2}`.replace(/\s/g, "");
}

export async function throttle(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
