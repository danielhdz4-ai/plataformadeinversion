import { readResponseJson } from "./http-json.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function geocodeSpain(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "es");
  await sleep(1100);
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "plataformadeinversion-scraper/1.0" },
  });
  if (!res.ok) return null;
  let data;
  try {
    data = await readResponseJson(res, "Nominatim search");
  } catch {
    return null;
  }
  const hit = data?.[0];
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, displayName: hit.display_name ?? null, postcode: hit.address?.postcode ?? null };
}

/** Centro aproximado del CP (Nominatim). */
export async function geocodePostalCodeSpain(postalCode) {
  const cp = String(postalCode ?? "").trim();
  if (!/^(0[1-9]\d{3}|[1-4]\d{4}|5[0-2]\d{3})$/.test(cp)) return null;
  return geocodeSpain(`${cp}, España`);
}

export async function reverseGeocodeSpain(lat, lng) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  await sleep(1100);
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "plataformadeinversion-scraper/1.0" },
  });
  if (!res.ok) return null;
  let data;
  try {
    data = await readResponseJson(res, "Nominatim reverse");
  } catch {
    return null;
  }
  const pc = data?.address?.postcode ?? null;
  const normalized = pc ? String(pc).replace(/\D/g, "").slice(0, 5) : null;
  return {
    lat,
    lon,
    postalCode: normalized && normalized.length === 5 ? normalized : null,
    city: data?.address?.city ?? data?.address?.town ?? data?.address?.municipality ?? null,
  };
}
