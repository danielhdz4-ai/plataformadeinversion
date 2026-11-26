/**
 * Trae API keys de un proyecto Supabase vivo y actualiza .env.local + Vercel.
 *
 * Requiere en .env.local (gitignored):
 *   SUPABASE_ACCESS_TOKEN=sbp_...
 *   SUPABASE_PROJECT_REF=oysvzprgwumctjooldvi
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function upsertEnvFile(path, updates) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const seen = new Set();
  const next = lines.map((line) => {
    const m = line.match(/^([A-Z0-9_]+)=/);
    if (!m || !(m[1] in updates)) return line;
    seen.add(m[1]);
    return `${m[1]}=${updates[m[1]]}`;
  });
  for (const [k, v] of Object.entries(updates)) {
    if (!seen.has(k)) next.push(`${k}=${v}`);
  }
  writeFileSync(path, `${next.filter((l, i, a) => !(i === a.length - 1 && l === "")).join("\n")}\n`, "utf8");
}

const env = { ...loadEnv(join(root, ".env.local")), ...loadEnv(join(root, "apps/web/.env.local")) };
const token = env.SUPABASE_ACCESS_TOKEN?.trim();
const ref = (process.env.SUPABASE_PROJECT_REF ?? env.SUPABASE_PROJECT_REF ?? "oysvzprgwumctjooldvi").trim();

if (!token) {
  console.error(
    JSON.stringify({
      ok: false,
      error: "Falta SUPABASE_ACCESS_TOKEN en .env.local",
      hint: "Supabase → Account → Access Tokens → crear token → pegar en .env.local",
    })
  );
  process.exit(1);
}

const list = spawnSync(
  "supabase",
  ["projects", "api-keys", "--project-ref", ref, "-o", "json"],
  { encoding: "utf8", shell: true, env: { ...process.env, SUPABASE_ACCESS_TOKEN: token } }
);
if (list.status !== 0) {
  console.error(list.stderr || list.stdout);
  process.exit(list.status ?? 1);
}

const keys = JSON.parse(list.stdout);
const anon = keys.find((k) => k.name === "anon" || k.name === "anon key")?.api_key;
const service = keys.find((k) => k.name === "service_role")?.api_key;
if (!anon || !service) {
  console.error(JSON.stringify({ ok: false, error: "No se encontraron claves anon/service en la respuesta" }));
  process.exit(1);
}

const url = `https://${ref}.supabase.co`;
const updates = {
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  SUPABASE_SERVICE_ROLE_KEY: service,
};

for (const p of [join(root, ".env.local"), join(root, "apps/web/.env.local")]) {
  try {
    upsertEnvFile(p, updates);
  } catch {
    writeFileSync(
      p,
      Object.entries(updates)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n") + "\n",
      "utf8"
    );
  }
}

const sync = spawnSync("node", ["scripts/ops/vercel-env-sync-local.mjs"], {
  cwd: root,
  encoding: "utf8",
  shell: true,
  env: { ...process.env, VERCEL_SCOPE: process.env.VERCEL_SCOPE ?? "danielhdz5-ai" },
});

console.log(
  JSON.stringify({
    ok: true,
    ref,
    url,
    envFilesUpdated: true,
    vercelSyncExit: sync.status,
  })
);