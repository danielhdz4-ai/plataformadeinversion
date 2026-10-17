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
  const data = await res.json();
  const hit = data?.[0];
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}
