/**
 * Importa secciones censales piloto (GeoJSON simplificado) → census_sections.
 * Uso: node scripts/jobs/import-census-seed.mjs [path/to.json]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const file =
  process.argv[2] ?? join(root, "scripts/jobs/data/census/barcelona-pilot.json");

const rows = JSON.parse(readFileSync(file, "utf8"));
const supabase = createClient(url, key);

let upserted = 0;
for (const row of rows) {
  const geojson = JSON.stringify(row.geojson);
  const { error } = await supabase.rpc("upsert_census_section_geom", {
    p_cusec: row.cusec,
    p_province_code: row.province_code,
    p_municipality_name: row.municipality_name,
    p_section_name: row.section_name,
    p_postal_codes: row.postal_codes ?? [],
    p_metrics: row.metrics ?? {},
    p_metrics_year: row.metrics_year ?? null,
    p_source_url: row.source_url ?? null,
    p_geojson: geojson,
  });
  if (error?.message?.includes("upsert_census_section_geom")) {
    console.error(
      "Missing RPC upsert_census_section_geom — run supabase/scripts/census-sections-full.sql in SQL Editor"
    );
    process.exit(1);
  }
  if (error) {
    console.error(row.cusec, error.message);
    continue;
  }
  upserted++;
}

console.log(JSON.stringify({ ok: true, upserted, file }));
