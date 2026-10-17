import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @param {Record<string, unknown>} portal */
export function portalToDbRow(portal) {
  const period = String(portal.periodTo ?? new Date().toISOString().slice(0, 7));
  const summary = portal.summary;
  if (!summary || typeof summary !== "object") {
    throw new Error("portal.summary required");
  }
  const s = summary;
  return {
    postal_code: String(portal.postalCode),
    period,
    price_m2: Number(s.priceM2),
    avg_price: Number(s.avgAmount),
    avg_surface: Number(s.avgSurface),
    operations_count: Number(s.salesCount),
    es_estimado: false,
    source_url: String(portal.sourceUrl ?? "https://www.penotariado.com/"),
    raw: { portal },
    scraped_at: new Date().toISOString(),
  };
}

export function loadNotaryJsonDir(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  return files.map((f) => {
    const full = path.join(dir, f);
    const portal = JSON.parse(fs.readFileSync(full, "utf8"));
    return portalToDbRow(portal);
  });
}

export function defaultNotaryDataDir() {
  return path.join(__dirname, "..", "data", "notary");
}
