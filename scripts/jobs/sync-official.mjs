/**
 * Sync MIVAU / INE CSV → official_market_stats (service role).
 * Run: node scripts/jobs/sync-official.mjs
 */
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";

const SOURCES = [
  {
    source: "mivau-vdp006",
    url: "https://cdn.mivau.gob.es/portal-web-mivau/Datos_MIVAU/CSV/VDP006_01.csv",
    geo_level: "national",
  },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

for (const src of SOURCES) {
  const res = await fetch(src.url);
  if (!res.ok) throw new Error(`${src.source} HTTP ${res.status}`);
  const text = await res.text();
  const file_hash = createHash("sha256").update(text).digest("hex");
  const period = new Date().toISOString().slice(0, 10);
  await supabase.from("official_market_stats").upsert(
    {
      source: src.source,
      geo_level: src.geo_level,
      geo_code: "ES",
      period,
      metrics: { rows: text.split("\n").length - 1 },
      source_url: src.url,
      file_hash,
      scraped_at: new Date().toISOString(),
    },
    { onConflict: "source,geo_level,geo_code,period" }
  );
  console.log(`OK ${src.source} hash=${file_hash.slice(0, 8)}`);
}
