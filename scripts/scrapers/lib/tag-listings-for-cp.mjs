import { getSupabase } from "./env.mjs";
import { geocodePostalCodeSpain } from "./geocode-es.mjs";
import { normalizeCp } from "./cp-utils.mjs";

/** Asigna postal_code a ventas geolocalizadas cerca del centro del CP (todos los portales). */
export async function tagListingsForPostalCode(postalCode, options = {}) {
  const cp = normalizeCp(postalCode);
  if (!cp) return { ok: false, error: "invalid_cp" };

  const geo = options.center ?? (await geocodePostalCodeSpain(cp));
  if (!geo) return { ok: false, error: "geocode_failed" };

  const radiusM = Number(options.radiusM ?? process.env.SCRAPE_CP_TAG_RADIUS_M ?? "2800");
  const supabase = getSupabase();

  const { data: tagged, error } = await supabase.rpc("tag_listings_postal_code", {
    p_cp: cp,
    p_lng: geo.lon,
    p_lat: geo.lat,
    p_radius_m: radiusM,
  });

  if (error) {
    if (/tag_listings_postal_code|function/i.test(error.message)) {
      return { ok: false, error: "rpc_missing", hint: "supabase/migrations/20251020120000_listings_by_postal_code.sql" };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, postalCode: cp, tagged: tagged ?? 0, center: { lat: geo.lat, lng: geo.lon }, radiusM };
}
