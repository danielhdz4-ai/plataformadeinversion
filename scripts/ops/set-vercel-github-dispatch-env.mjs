/** Copia GH_TOKEN → GITHUB_WORKFLOW_TOKEN en Vercel prod (sin imprimir secretos). */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = join(root, ".env.local");
let token = process.env.GH_TOKEN?.trim();
if (!token) {
  try {
    const raw = readFileSync(envPath, "utf8");
    const m = raw.match(/^GH_TOKEN=(.+)$/m);
    token = m?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch {
    /* ignore */
  }
}
if (!token) {
  console.error("Missing GH_TOKEN");
  process.exit(1);
}

const cwd = join(root, "apps/web");
for (const [name, value] of [
  ["GITHUB_WORKFLOW_TOKEN", token],
  ["GITHUB_REPOSITORY", "danielhdz4-ai/plataformadeinversion"],
]) {
  const r = spawnSync(
    "vercel",
    ["env", "add", name, "production", "--scope", "danielhdz4-ais-projects", "--force", "--yes"],
    { cwd, input: value, encoding: "utf8" }
  );
  console.log(name, r.status === 0 ? "ok" : (r.stderr || r.stdout || "").slice(0, 200));
}
