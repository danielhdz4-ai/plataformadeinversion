import { getDbClient } from "@/lib/supabase/request-client";
import type { SupabaseClient } from "@supabase/supabase-js";

/** A partir de aquí la zona se considera "fría" y se re-scrapea al entrar. */
export const CP_COLD_ZONE_HOURS = Number(process.env.CP_COLD_ZONE_HOURS ?? "72");

let envWarned = false;
export function coldZoneHours(): number {
  const h = Number(process.env.CP_COLD_ZONE_HOURS ?? "72");
  if (!envWarned) {
    envWarned = true;
    console.info("cp cold zone config", {
      CP_COLD_ZONE_HOURS: process.env.CP_COLD_ZONE_HOURS ?? "(default)",
      hours: h,
    });
  }
  return Number.isFinite(h) ? h : 72;
}

/**
 * Horas desde el último anuncio importado con ese CP.
 * `null` = no hay ningún dato para la zona (también cuenta como fría).
 */
export async function cpLastScrapeHours(
  cp: string,
  supabase?: SupabaseClient
): Promise<number | null> {
  const normalized = cp.replace(/\D/g, "").slice(0, 5);
  if (normalized.length !== 5) return null;

  const client = supabase ?? (await getDbClient());
  if (!client) return null;

  const { data, error } = await client
    .from("listings")
    .select("scraped_at")
    .eq("postal_code", normalized)
    .eq("operation", "sale")
    .eq("status", "active")
    .not("scraped_at", "is", null)
    .order("scraped_at", { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;

  const t = Date.parse(String(data[0].scraped_at));
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 3_600_000;
}
