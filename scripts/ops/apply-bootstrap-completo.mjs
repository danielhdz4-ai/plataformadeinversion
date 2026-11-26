/**
 * Ejecuta supabase/bootstrap-completo.sql contra el proyecto remoto.
 * Requiere SUPABASE_DB_URL en .env.local (URI del pooler de Supabase → Database → Connect).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const env = {};
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {
  /* skip */
}

const dbUrl = process.env.SUPABASE_DB_URL ?? env.SUPABASE_DB_URL ?? env.DATABASE_URL;
if (!dbUrl) {
  console.error(
    JSON.stringify({
      ok: false,
      error: "Falta SUPABASE_DB_URL",
      hint: "Supabase → Project Settings → Database → Connection string (Session pooler)",
    })
  );
  process.exit(1);
}

const sqlPath = join(root, "supabase", "bootstrap-completo.sql");
const body = readFileSync(sqlPath, "utf8");
const sql = postgres(dbUrl, { max: 1, idle_timeout: 10, connect_timeout: 30 });

try {
  await sql.unsafe(body);
  console.log(JSON.stringify({ ok: true, applied: "bootstrap-completo.sql" }));
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
} finally {
  await sql.end();
}