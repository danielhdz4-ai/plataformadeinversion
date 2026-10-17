import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
function loadEnvFile(rel) {
  try {
    return readFileSync(join(root, rel), "utf8");
  } catch {
    return "";
  }
}
const raw = [loadEnvFile(".env.local"), loadEnvFile("apps/web/.env.local")].join("\n");
for (const line of raw.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 1) continue;
  const k = t.slice(0, i);
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  process.env[k] = v;
}

const cmd = process.argv.slice(2);
if (cmd.length === 0) {
  console.error("Usage: node scripts/ops/run-with-web-env.mjs <command...>");
  process.exit(1);
}

const r = spawnSync(cmd[0], cmd.slice(1), { stdio: "inherit", env: process.env, shell: true, cwd: root });
process.exit(r.status ?? 1);
