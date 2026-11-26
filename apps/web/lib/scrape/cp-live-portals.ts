import { defaultPortalToggles, selectedPortals, type ScanPortalId } from "@/lib/scan/portal-options";

/** Portales CP en vivo: API rápidos primero (sin Playwright en la petición HTTP). */
export function portalsForCpLiveImport(): ScanPortalId[] {
  if (process.env.SCAN_CP_PORTALS) {
    return process.env.SCAN_CP_PORTALS.split(",")
      .map((s) => s.trim())
      .filter(Boolean) as ScanPortalId[];
  }
  /** Sin Playwright en la petición HTTP (habitaclia/Kelify/Idealista → Actions/cron). */
  const fast: ScanPortalId[] = ["fotocasa", "pisos_com", "kelify", "hipoges", "solvia"];
  const toggles = defaultPortalToggles();
  const selected = selectedPortals(toggles);
  return fast.filter((p) => selected.includes(p));
}
