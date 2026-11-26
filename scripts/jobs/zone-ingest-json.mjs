/** Zone ingest → stdout JSON (Vercel spawn). */
import { ingestZoneForPolygon } from "../scrapers/lib/zone-ingest.mjs";

const raw = process.env.POLYGON_GEOJSON;
if (!raw) {
  console.log(JSON.stringify({ ok: false, error: "missing POLYGON_GEOJSON" }));
  process.exit(1);
}

const polygon = JSON.parse(raw);
const scanId = process.env.SCAN_ZONE_SCAN_ID || undefined;
const portals = process.env.SCAN_ZONE_PORTALS
  ? process.env.SCAN_ZONE_PORTALS.split(",").map((s) => s.trim()).filter(Boolean)
  : undefined;

process.env.SCAN_CP_SKIP_PLAYWRIGHT = "1";

try {
  const result = await ingestZoneForPolygon(polygon, { scanId, portals });
  console.log(JSON.stringify(result));
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
}
