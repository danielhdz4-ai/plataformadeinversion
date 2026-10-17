import type { NotaryPortalStats } from "@/lib/notariado/types";

export function portalFromNotaryRaw(raw: unknown): NotaryPortalStats | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.portal && typeof r.portal === "object") {
    return r.portal as NotaryPortalStats;
  }
  if (r.source === "penotariado" && r.summary) {
    return raw as NotaryPortalStats;
  }
  return null;
}

export function periodLabel(portal: NotaryPortalStats): string {
  return `${portal.periodFrom} – ${portal.periodTo}`;
}
