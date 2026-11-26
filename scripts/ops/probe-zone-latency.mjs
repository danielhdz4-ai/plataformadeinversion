const BASE = "https://plataformadeinversion.vercel.app";
const CP = "28031";
const t0 = Date.now();
const geo = await fetch(`${BASE}/api/geocode?q=${CP}`).then((r) => r.json());
const tGeo = Date.now() - t0;
const hit = geo.results?.[0];
console.log("geocode", tGeo, "ms", hit?.label, hit?.lat, hit?.lng, "bbox", hit?.bbox);

const body = {
  lat: hit.lat,
  lng: hit.lng,
  cp: CP,
  radiusM: 6500,
  limit: 80,
  offset: 0,
  maxAgeDays: 14,
  live: true,
  waitScrape: false,
  chollosOnly: false,
  label: hit.label,
  cpBbox: hit.bbox ?? null,
};

// Replica lo que manda la página al cargar la zona.
const t1 = Date.now();
const res = await fetch(`${BASE}/api/opportunities/zone`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const txt = await res.text();
console.log("zone", res.status, Date.now() - t1, "ms", txt.slice(0, 600));

// Segunda llamada (zona ya "caliente" tras el primer refresh).
const t2 = Date.now();
const res2 = await fetch(`${BASE}/api/opportunities/zone`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const body2 = await res2.json();
console.log("zone2", res2.status, Date.now() - t2, "ms", JSON.stringify({
  items: body2.items?.length,
  totalInZone: body2.totalInZone,
  refreshStarted: body2.refreshStarted,
  staleRefresh: body2.staleRefresh,
  radiusM: body2.radiusM,
}));
