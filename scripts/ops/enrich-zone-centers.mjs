/**
 * Rellena lat/lng en catálogos usando coordenadas medias del listado Fotocasa (pág. 1).
 * node scripts/ops/enrich-zone-centers.mjs [madrid|bcn|all]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchFotocasaListPage } from "../scrapers/lib/fotocasa-api.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const scrapeDir = join(__dir, "../scrape");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function centerForZone(slug) {
  const { listings } = await fetchFotocasaListPage(slug, 1);
  const pts = listings.filter((l) => l.lat != null && l.lon != null);
  if (pts.length === 0) return null;
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lon = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
  return { lat, lng: lon };
}

async function enrichFile(file, key = "fotocasaZones") {
  const path = join(scrapeDir, file);
  const catalog = JSON.parse(readFileSync(path, "utf8"));
  const zones = catalog[key] ?? [];
  let updated = 0;
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (z.lat != null && z.lng != null) continue;
    const slug = z.slug.includes("/") ? z.slug : z.slug;
    try {
      const c = await centerForZone(slug);
      if (c) {
        zones[i] = { ...z, lat: c.lat, lng: c.lng };
        updated++;
        console.log("ok", slug, c.lat.toFixed(4), c.lng.toFixed(4));
      } else {
        console.warn("no coords", slug);
      }
    } catch (e) {
      console.warn("fail", slug, e instanceof Error ? e.message : e);
    }
    await sleep(Number(process.env.PAUSE_MS ?? "400"));
  }
  catalog[key] = zones;
  writeFileSync(path, JSON.stringify(catalog, null, 2) + "\n");
  console.log(file, "updated", updated, "/", zones.length);
}

const which = process.argv[2] ?? "all";
if (which === "madrid" || which === "all") await enrichFile("madrid-districts.json");
if (which === "valencia" || which === "all") await enrichFile("valencia-districts.json");
if (which === "sevilla" || which === "all") await enrichFile("sevilla-districts.json");
if (which === "bcn" || which === "all") await enrichFile("bcn-metro.json");
