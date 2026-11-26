/**
 * Stock FRESCO por CP — mismo criterio que el feed de Oportunidades (14 días).
 * Reutilizable desde jobs y auditorías.
 */
import { getSupabase } from "../scrapers/lib/env.mjs";
import { geocodePostalCodeSpain } from "../scrapers/lib/geocode-es.mjs";

const NON_RESIDENTIAL = new Set([
  "garaje",
  "trastero",
  "local",
  "parking",
  "oficina",
  "nave",
  "terreno",
]);

const RADIUS_STEPS = [5500, 9000, 12000];

export async function countFreshInCp(cpInput, opts = {}) {
  const cp = String(cpInput ?? "").replace(/\D/g, "").slice(0, 5);
  const freshDays = Number(opts.freshDays ?? process.env.FRESH_DAYS ?? "14");
  const target = Number(opts.target ?? process.env.ZONE_STOCK_TARGET ?? "80");
  if (cp.length !== 5) return { cp, fresh: 0, error: "invalid_cp" };

  const geo = await geocodePostalCodeSpain(cp);
  if (!geo) return { cp, fresh: 0, error: "geocode" };

  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - freshDays * 86400000).toISOString();
  const seen = new Set();
  let usedRadius = RADIUS_STEPS[0];
  let lastError = null;

  for (const radiusM of RADIUS_STEPS) {
    usedRadius = radiusM;
    const { data, error } = await supabase.rpc("listings_for_postal_code", {
      p_cp: cp,
      p_lng: geo.lon,
      p_lat: geo.lat,
      p_radius_m: radiusM,
      max_rows: 800,
      portal_filter: null,
    });
    if (error) {
      lastError = error.message;
      break;
    }
    const ids = (data ?? []).map((r) => r.id);
    if (ids.length === 0) break;
    const { data: freshRows, error: freshErr } = await supabase
      .from("listings")
      .select("id, property_kind")
      .in("id", ids)
      .eq("status", "active")
      .eq("operation", "sale")
      .gte("scraped_at", cutoff);
    if (freshErr) {
      lastError = freshErr.message;
      break;
    }
    for (const row of freshRows ?? []) {
      if (NON_RESIDENTIAL.has(String(row.property_kind ?? ""))) continue;
      seen.add(row.id);
    }
    if (seen.size >= target) break;
  }
  return { cp, fresh: seen.size, radiusM: usedRadius, freshDays, error: lastError };
}
