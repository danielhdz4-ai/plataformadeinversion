import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const web = join(root, "apps/web");
const scope = process.env.VERCEL_SCOPE ?? "danielhdz5-ai";

/** Repo con los workflows de scrape/ingest (cuenta del PAT GH). */
const CANONICAL_GITHUB_REPO =
  process.env.GITHUB_REPOSITORY ?? "danielhdz4-ai/plataformadeinversion";

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_NAME",
  "OPEN_ACCESS",
  "NEXT_PUBLIC_OPEN_ACCESS",
  "OPEN_ACCESS_USER_ID",
  "NEXT_PUBLIC_DEMO_MODE",
  "CRON_SECRET",
  "GITHUB_REPOSITORY",
  "GITHUB_WORKFLOW_TOKEN",
  "GH_TOKEN",
];

function loadEnv(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[m[1]] = v;
    }
  } catch {
    /* skip */
  }
  return out;
}

const env = { ...loadEnv(join(root, ".env.local")), ...loadEnv(join(web, ".env.local")) };
if (!env.CRON_SECRET) env.CRON_SECRET = randomBytes(24).toString("hex");

const derived = { ...env };
if (!derived.GITHUB_WORKFLOW_TOKEN && derived.GH_TOKEN) {
  derived.GITHUB_WORKFLOW_TOKEN = derived.GH_TOKEN;
}
if (!derived.GITHUB_REPOSITORY) {
  derived.GITHUB_REPOSITORY = CANONICAL_GITHUB_REPO;
}

for (const key of KEYS) {
  const val = derived[key] ?? env[key];
  if (!val) continue;
  for (const target of ["production", "preview", "development"]) {
    const isPublic = key.startsWith("NEXT_PUBLIC_");
    const typeFlag = isPublic
      ? "--type config"
      : /KEY|SECRET|TOKEN|PASS/i.test(key)
        ? "--sensitive"
        : "";
    const cmd = `vercel env add ${key} ${target} --scope ${scope} --yes --force ${typeFlag} --value ${JSON.stringify(val)}`.trim();
    const r = spawnSync(cmd, {
      cwd: web,
      encoding: "utf8",
      shell: true,
      maxBuffer: 10 * 1024 * 1024,
    });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    if (r.error) {
      console.error(key, target, r.error.message);
      continue;
    }
    if (r.status !== 0 && !/already exists|has already been added/i.test(out)) {
      console.error(key, target, "exit", r.status, out.trim());
    } else if (out.trim()) {
      console.log(key, target, /Overrode|Added|Saving/i.test(out) ? "ok" : out.trim().slice(0, 80));
    }
  }
}

for (const target of ["production", "preview", "development"]) {
  const cmd = `vercel env add NEXT_PUBLIC_SITE_URL ${target} --scope ${scope} --yes --force --type config --value "https://plataformadeinversion.vercel.app"`;
  spawnSync(cmd, { cwd: web, encoding: "utf8", shell: true, maxBuffer: 10 * 1024 * 1024 });
}

console.log(JSON.stringify({ ok: true, scope, keys: KEYS.filter((k) => env[k]) }));