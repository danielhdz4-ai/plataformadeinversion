/** Portales de venta soportados en ingestión (alineado con apps/web/lib/scan/portal-options). */
export const ALL_SALE_PORTAL_IDS = [
  "fotocasa",
  "pisos_com",
  "kelify",
  "habitaclia",
  "hipoges",
  "solvia",
  "idealista",
];

export function normalizeIngestPortals(explicit) {
  let list;
  if (explicit?.length) {
    list = explicit.filter((p) => ALL_SALE_PORTAL_IDS.includes(p));
  } else if (process.env.SCAN_ZONE_PORTALS) {
    list = process.env.SCAN_ZONE_PORTALS.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    list = ALL_SALE_PORTAL_IDS.filter((id) => id !== "idealista");
  }
  if (!list.includes("pisos_com")) list.push("pisos_com");
  return list;
}

export function portalEnabled(portals, id) {
  return portals.includes(id);
}
