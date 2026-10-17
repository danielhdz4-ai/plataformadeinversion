/**
 * Importa estadísticas del Portal del Notariado (penotariado.com) por CP.
 *
 * Fuentes:
 * 1. JSON en scripts/jobs/data/notary/{postalCode}.json (informe PDF / exportación portal)
 * 2. (Opcional) PENOTARIADO_FETCH=1 — intenta API interna (ver lib/fetch-penotariado-cp.mjs)
 *
 * Uso: node --env-file=.env.local scripts/jobs/sync-notary-barcelona-cp.mjs
 *      node --env-file=.env.local scripts/jobs/sync-notary-barcelona-cp.mjs 08026 08001
 */
import { createClient } from "@supabase/supabase-js";
import { defaultNotaryDataDir, loadNotaryJsonDir, portalToDbRow } from "./lib/notary-import.mjs";
import { fetchPenotariadoCp } from "./lib/fetch-penotariado-cp.mjs";
import fs from "node:fs";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key);

const dataDir = defaultNotaryDataDir();
const argvCps = process.argv.slice(2).filter((a) => /^\d{5}$/.test(a));

let rows = [];

if (process.env.PENOTARIADO_FETCH === "1" && argvCps.length > 0) {
  for (const cp of argvCps) {
    const portal = await fetchPenotariadoCp(cp);
    if (portal) rows.push(portalToDbRow(portal));
  }
}

if (rows.length === 0) {
  if (argvCps.length > 0) {
    for (const cp of argvCps) {
      const f = path.join(dataDir, `${cp}.json`);
      if (!fs.existsSync(f)) {
        console.warn("skip (no JSON):", cp);
        continue;
      }
      const portal = JSON.parse(fs.readFileSync(f, "utf8"));
      rows.push(portalToDbRow(portal));
    }
  } else {
    rows = loadNotaryJsonDir(dataDir);
  }
}

if (rows.length === 0) {
  console.error("No notary rows to upsert. Add scripts/jobs/data/notary/08026.json or pass CP codes.");
  process.exit(1);
}

const { error } = await supabase.from("notary_stats").upsert(rows, {
  onConflict: "postal_code,period",
});
if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, count: rows.length, postalCodes: rows.map((r) => r.postal_code) }));
