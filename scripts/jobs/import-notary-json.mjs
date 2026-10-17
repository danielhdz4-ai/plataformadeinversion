/**
 * Importa un JSON exportado / transcrito del informe penotariado.com a Supabase.
 *
 * node --env-file=.env.local scripts/jobs/import-notary-json.mjs path/to/08026.json
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { portalToDbRow } from "./lib/notary-import.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: import-notary-json.mjs <file.json>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

const portal = JSON.parse(fs.readFileSync(file, "utf8"));
const row = portalToDbRow(portal);

const { error } = await supabase.from("notary_stats").upsert(row, {
  onConflict: "postal_code,period",
});
if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, postal_code: row.postal_code, period: row.period }));
