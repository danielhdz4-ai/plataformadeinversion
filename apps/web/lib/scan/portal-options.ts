export const SCAN_PORTAL_IDS = [
  "kelify",
  "idealista",
  "pisos_com",
  "hipoges",
  "solvia",
  "fotocasa",
  "habitaclia",
] as const;

export type ScanPortalId = (typeof SCAN_PORTAL_IDS)[number];

export const SCAN_PORTALS: { id: ScanPortalId; label: string }[] = [
  { id: "kelify", label: "Kelify" },
  { id: "idealista", label: "Idealista" },
  { id: "pisos_com", label: "pisos.com" },
  { id: "hipoges", label: "Hipoges" },
  { id: "solvia", label: "Solvia" },
  { id: "fotocasa", label: "Fotocasa" },
  { id: "habitaclia", label: "habitaclia" },
];

export function defaultPortalToggles(): Record<ScanPortalId, boolean> {
  return Object.fromEntries(SCAN_PORTAL_IDS.map((id) => [id, true])) as Record<
    ScanPortalId,
    boolean
  >;
}

export function selectedPortals(toggles: Record<string, boolean>): ScanPortalId[] {
  return SCAN_PORTAL_IDS.filter((id) => toggles[id] !== false);
}
