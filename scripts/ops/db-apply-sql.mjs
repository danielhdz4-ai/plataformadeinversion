/**
 * Aplica SQL a Supabase remoto sin psql ni token de gestión.
 *
 * Estrategia: crea una función temporal `exec_sql_*` vía PostgREST no es posible
 * sin SQL; por eso usamos la API de Supabase (Management) si hay token, y si no,
 * guiamos el error. Con SUPABASE_ACCESS_TOKEN aplica la migración completa.
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node --env-file=.env.local scripts/ops/db-apply-sql.mjs supabase/migrations/xxx.sql
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("Uso: db-apply-sql.mjs <ruta.sql>");
  process.exit(1);
}
const sql = readFileSync(file, "utf8");
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const projectRef =
  process.env.SUPABASE_PROJECT_REF?.trim() ??
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

if (!token) {
  console.error(
    "Falta SUPABASE_ACCESS_TOKEN (Supabase → Account → Access Tokens). Sin él las migraciones deben correrse en el SQL Editor."
  );
  process.exit(2);
}
if (!projectRef) {
  console.error("No se pudo deducir el project ref de NEXT_PUBLIC_SUPABASE_URL");
  process.exit(2);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const body = await res.text();
if (!res.ok) {
  console.error(`[${basename(file)}] HTTP ${res.status}`, body.slice(0, 800));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, file, projectRef, result: body.slice(0, 400) }));
