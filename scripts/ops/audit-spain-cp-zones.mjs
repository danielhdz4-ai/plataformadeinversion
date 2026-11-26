/**
 * Auditoría nacional: feed por CP vía API prod (geocode + zone POST).
 * Uso: node scripts/ops/audit-spain-cp-zones.mjs [--base URL] [--wait]
 */
const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "https://plataformadeinversion.vercel.app";

const WAIT_SCRAPE = process.argv.includes("--wait");

/** CP representativos — todas las CCAA, ciudad + pueblo/rural. */
const SAMPLES = [
  { cp: "01001", label: "Vitoria-Gasteiz" },
  { cp: "02001", label: "Albacete" },
  { cp: "03001", label: "Alicante" },
  { cp: "04001", label: "Almería ciudad" },
  { cp: "04638", label: "Mojácar (costa)" },
  { cp: "07001", label: "Palma" },
  { cp: "08001", label: "Barcelona centro" },
  { cp: "09001", label: "Burgos" },
  { cp: "10001", label: "Cáceres" },
  { cp: "11001", label: "Cádiz" },
  { cp: "12001", label: "Castellón" },
  { cp: "13001", label: "Ciudad Real" },
  { cp: "14001", label: "Córdoba" },
  { cp: "15001", label: "A Coruña" },
  { cp: "17001", label: "Girona" },
  { cp: "18001", label: "Granada" },
  { cp: "18411", label: "Pampaneira (Alpujarra)" },
  { cp: "20001", label: "Donostia" },
  { cp: "21001", label: "Huelva" },
  { cp: "21200", label: "Aracena (sierra)" },
  { cp: "22001", label: "Huesca" },
  { cp: "23001", label: "Jaén" },
  { cp: "24001", label: "León" },
  { cp: "25001", label: "Lleida" },
  { cp: "26001", label: "Logroño" },
  { cp: "27001", label: "Lugo" },
  { cp: "28001", label: "Madrid centro" },
  { cp: "28033", label: "Madrid norte" },
  { cp: "28901", label: "Getafe" },
  { cp: "29001", label: "Málaga" },
  { cp: "30001", label: "Murcia" },
  { cp: "31001", label: "Pamplona" },
  { cp: "32005", label: "Ourense" },
  { cp: "33001", label: "Oviedo" },
  { cp: "33201", label: "Gijón" },
  { cp: "35001", label: "Las Palmas" },
  { cp: "36001", label: "Vigo" },
  { cp: "37001", label: "Salamanca" },
  { cp: "38001", label: "Santa Cruz Tenerife" },
  { cp: "39001", label: "Santander" },
  { cp: "41001", label: "Sevilla" },
  { cp: "43001", label: "Tarragona" },
  { cp: "44001", label: "Teruel" },
  { cp: "45001", label: "Toledo" },
  { cp: "46001", label: "Valencia" },
  { cp: "47001", label: "Valladolid" },
  { cp: "48001", label: "Bilbao" },
  { cp: "50001", label: "Zaragoza" },
  { cp: "05267", label: "Rural Ávila" },
  { cp: "39680", label: "Rural Cantabria" },
  { cp: "25126", label: "Rural Lleida" },
];

async function geocodeCp(cp) {
  const res = await fetch(`${BASE}/api/geocode?q=${encodeURIComponent(cp)}`, {
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) return { error: `geocode_http_${res.status}` };
  const body = await res.json();
  const hit = body.results?.[0];
  if (!hit?.lat || !hit?.lng) return { error: "geocode_empty" };
  return { lat: hit.lat, lng: hit.lng, label: hit.label ?? cp };
}

async function zoneFeed(cp, lat, lng) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/opportunities/zone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lat,
      lng,
      cp,
      live: true,
      waitScrape: WAIT_SCRAPE,
      chollosOnly: false,
      limit: 200,
    }),
    signal: AbortSignal.timeout(WAIT_SCRAPE ? 280_000 : 90_000),
  });
  const ms = Date.now() - t0;
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { ms, error: `json_${res.status}`, raw: text.slice(0, 120) };
  }
  if (!res.ok) return { ms, error: body.error ?? `http_${res.status}`, code: body.code };
  return {
    ms,
    totalInZone: body.totalInZone ?? 0,
    items: body.items?.length ?? 0,
    qualified: body.totalQualified ?? body.opportunitiesInZone ?? 0,
    refreshStarted: Boolean(body.refreshStarted),
  };
}

async function listingsByCp(cp) {
  const t0 = Date.now();
  const res = await fetch(
    `${BASE}/api/map/listings-by-cp?cp=${cp}&live=1&wait=0&max=400`,
    { signal: AbortSignal.timeout(60_000) }
  );
  const ms = Date.now() - t0;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ms, error: err.error ?? `http_${res.status}` };
  }
  const body = await res.json();
  return {
    ms,
    count: body.total ?? body.features?.length ?? body.listings?.length ?? body.count ?? 0,
    refreshStarted: Boolean(body.refreshStarted),
  };
}

function bucket(total) {
  if (total >= 80) return "A";
  if (total >= 25) return "B";
  if (total >= 5) return "C";
  return "D";
}

async function runOne(sample) {
  const { cp, label } = sample;
  const geo = await geocodeCp(cp);
  if (geo.error) {
    return { cp, label, geoError: geo.error };
  }
  const [zone, map] = await Promise.all([
    zoneFeed(cp, geo.lat, geo.lng),
    listingsByCp(cp),
  ]);
  const total = Math.max(zone.totalInZone ?? 0, map.count ?? 0);
  return {
    cp,
    label,
    lat: geo.lat,
    lng: geo.lng,
    zone,
    map,
    bucket: zone.error ? "E" : bucket(total),
  };
}

async function pool(items, concurrency, fn) {
  const out = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
      process.stderr.write(`[${idx + 1}/${items.length}] ${items[idx].cp} ${items[idx].label}\n`);
      await new Promise((r) => setTimeout(r, 120));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return out;
}

const concurrency = Number(process.env.AUDIT_CONCURRENCY ?? "2");
const results = await pool(SAMPLES, concurrency, runOne);

const summary = {
  base: BASE,
  waitScrape: WAIT_SCRAPE,
  tested: results.length,
  buckets: { A: 0, B: 0, C: 0, D: 0, E: 0 },
  avgZoneMs: 0,
  errors: [],
  weak: [],
  strong: [],
};

let msSum = 0;
let msN = 0;
for (const r of results) {
  if (r.geoError) {
    summary.buckets.E++;
    summary.errors.push({ cp: r.cp, label: r.label, geoError: r.geoError });
    continue;
  }
  if (r.zone.error) {
    summary.buckets.E++;
    summary.errors.push({ cp: r.cp, label: r.label, zone: r.zone });
    continue;
  }
  summary.buckets[r.bucket]++;
  if (r.zone.ms) {
    msSum += r.zone.ms;
    msN++;
  }
  const total = Math.max(r.zone.totalInZone ?? 0, r.map.count ?? 0);
  const row = {
    cp: r.cp,
    label: r.label,
    total,
    zoneItems: r.zone.items,
    qualified: r.zone.qualified,
    mapCount: r.map.count,
    zoneMs: r.zone.ms,
    refresh: r.zone.refreshStarted || r.map.refreshStarted,
  };
  if (r.bucket === "A" || r.bucket === "B") summary.strong.push(row);
  else summary.weak.push(row);
}

summary.avgZoneMs = msN ? Math.round(msSum / msN) : null;
summary.results = results;

console.log(JSON.stringify(summary, null, 2));