import type { GeocodeHit } from "@/lib/map/geocode-spain";
import { createAdminClient } from "@/lib/supabase/admin";

export async function fetchCpCentroidFromDb(cp: string): Promise<GeocodeHit | null> {
  const normalized = cp.replace(/\D/g, "").slice(0, 5);
  if (normalized.length !== 5) return null;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("cp_centroids")
      .select("postal_code, lat, lng, label")
      .eq("postal_code", normalized)
      .maybeSingle();

    if (error || !data) return null;
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      label: data.label?.trim() || `CP ${normalized}, España`,
      lat,
      lng,
      bbox: null,
    };
  } catch {
    return null;
  }
}

export async function upsertCpCentroid(
  cp: string,
  hit: Pick<GeocodeHit, "lat" | "lng" | "label">,
  source: string
): Promise<void> {
  const normalized = cp.replace(/\D/g, "").slice(0, 5);
  if (normalized.length !== 5) return;

  try {
    const supabase = createAdminClient();
    await supabase.from("cp_centroids").upsert({
      postal_code: normalized,
      lat: hit.lat,
      lng: hit.lng,
      label: hit.label,
      source,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("cp_centroids upsert", normalized, e);
  }
}