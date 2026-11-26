/**
 * Perfila los RPC del feed de zona (sin pasar por la app) para ver dónde se van los segundos.
 * Uso: CP=28031 node --env-file=.env.local scripts/ops/profile-zone-rpc.mjs
 */
import { getSupabase } from "../scrapers/lib/env.mjs";

const CP = (process.env.CP ?? "28031").replace(/\D/g, "").slice(0, 5);
const supabase = getSupabase();

const geo = await fetch(`https://plataformadeinversion.vercel.app/api/geocode?q=${CP}`).then((r) =>
  r.json()
);
const hit = geo.results?.[0];
if (!hit) throw new Error("geocode sin resultados");
const { lat, lng } = hit;
console.log("centro", CP, lat, lng);

async function time(label, fn) {
  const t = Date.now();
  try {
    const r = await fn();
    console.log(label.padEnd(42), String(Date.now() - t).padStart(6), "ms", r);
  } catch (e) {
    console.log(label.padEnd(42), String(Date.now() - t).padStart(6), "ms ERR", e.message);
  }
}

for (const radius of [6500, 12000, 18000]) {
  await time(`tag_listings_postal_code r=${radius}`, async () => {
    const { data, error } = await supabase.rpc("tag_listings_postal_code", {
      p_cp: CP,
      p_lng: lng,
      p_lat: lat,
      p_radius_m: radius,
    });
    if (error) throw error;
    return `tagged=${data}`;
  });
  await time(`listings_for_postal_code r=${radius}`, async () => {
    const { data, error } = await supabase.rpc("listings_for_postal_code", {
      p_cp: CP,
      p_lng: lng,
      p_lat: lat,
      p_radius_m: radius,
      max_rows: 800,
      portal_filter: null,
    });
    if (error) throw error;
    return `rows=${data?.length}`;
  });
}

await time("map_listings_in_bbox (madrid 12km)", async () => {
  const dLat = 12000 / 111000;
  const dLng = 12000 / (111000 * Math.cos((lat * Math.PI) / 180));
  const { data, error } = await supabase.rpc("map_listings_in_bbox", {
    min_lng: lng - dLng,
    min_lat: lat - dLat,
    max_lng: lng + dLng,
    max_lat: lat + dLat,
    max_rows: 200,
    portal_filter: null,
  });
  if (error) throw error;
  return `rows=${data?.length}`;
});
