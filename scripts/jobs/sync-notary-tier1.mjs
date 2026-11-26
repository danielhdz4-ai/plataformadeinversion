/**
 * Upsert notary_stats para CP Tier 1 (JSON en data/notary/{cp}.json o fetch opcional).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultNotaryDataDir, portalToDbRow } from "./lib/notary-import.mjs";
import { fetchPenotariadoCp } from "./lib/fetch-penotariado-cp.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const config = JSON.parse(
  readFileSync(join(root, "scripts/jobs/data/notary/tier1-cps.json"), "utf8")
);
const codes = config.postalCodes ?? [];
const dataDir = defaultNotaryDataDir();
const supabase = createClient(url, key);
const rows = [];
const pauseMs = Number(process.env.NOTARY_FETCH_PAUSE_MS ?? "1200");

for (const cp of codes) {
  let portal = null;
  if (process.env.PENOTARIADO_FETCH === "1") {
    portal = await fetchPenotariadoCp(cp);
    await new Promise((r) => setTimeout(r, pauseMs));
  }
  if (!portal) {
    const f = join(dataDir, `${cp}.json`);
    try {
      portal = JSON.parse(readFileSync(f, "utf8"));
    } catch {
      console.warn("skip (no JSON, no fetch):", cp);
      continue;
    }
  }
  rows.push(portalToDbRow(portal));
}

if (rows.length === 0) {
  console.log(JSON.stringify({ ok: true, count: 0, note: "no rows" }));
  process.exit(0);
}

const { error } = await supabase.from("notary_stats").upsert(rows, {
  onConflict: "postal_code,period",
});
if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, count: rows.length, postalCodes: rows.map((r) => r.postal_code) }));
