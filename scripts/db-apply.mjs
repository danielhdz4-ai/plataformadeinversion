/**
 * Aplica migraciones SQL en orden (requiere SUPABASE_DB_URL).
 * Ejemplo:
 *   SUPABASE_DB_URL="postgresql://postgres.[ref]:[password]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres" node scripts/db-apply.mjs
 */
import { readdir, readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Set SUPABASE_DB_URL (Session pooler URI from Supabase → Database → Connect).");
  process.exit(1);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

const sql = postgres(dbUrl, { max: 1, idle_timeout: 5 });

for (const file of files) {
  const body = await readFile(path.join(migrationsDir, file), "utf8");
  console.log(`Applying ${file}…`);
  await sql.unsafe(body);
  console.log(`OK ${file}`);
}

await sql.end();
console.log("All migrations applied.");
