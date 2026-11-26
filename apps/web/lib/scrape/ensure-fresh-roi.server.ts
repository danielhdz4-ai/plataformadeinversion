import { createClient } from "@supabase/supabase-js";
import { importScraperModule } from "@/lib/scrape/load-scraper-module";

export type EnsureRoiResult = {
  candidates: number;
  updated: number;
  skipped?: string;
  error?: string;
};

/**
 * Recalcula ROI de los anuncios frescos de un CP (mismo criterio que Oportunidades).
 * Se ejecuta tras importar; sin ROI el feed aparece vacío.
 */
export async function ensureFreshRoi(cp: string): Promise<EnsureRoiResult> {
  if (process.env.VERCEL === "1") {
    globalThis.__PI_CREATE_SUPABASE__ = (url: string, key: string) => createClient(url, key);
  }
  try {
    const mod = await importScraperModule<{
      ensureFreshRoi: (c: string, o?: Record<string, unknown>) => Promise<EnsureRoiResult>;
    }>("scripts/scrapers/lib/ensure-fresh-roi.mjs");
    return await mod.ensureFreshRoi(cp);
  } catch (e) {
    return { candidates: 0, updated: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Igual que `ensureFreshRoi` pero para varios CP (cron de alquiler). */
export async function ensureFreshRoiForZone(cps: string[]): Promise<{
  cps: number;
  updated: number;
  errors: number;
}> {
  let updated = 0;
  let errors = 0;
  for (const cp of cps) {
    const r = await ensureFreshRoi(cp);
    if (r.error) errors++;
    updated += r.updated ?? 0;
  }
  return { cps: cps.length, updated, errors };
}
