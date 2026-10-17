/**
 * Push main usando GH_TOKEN de .env.local (cuenta danielhdz4-ai).
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = join(root, ".env.local");
let token = process.env.GH_TOKEN;
if (!token) {
  const raw = readFileSync(envPath, "utf8");
  const m = raw.match(/^GH_TOKEN=(.+)$/m);
  token = m?.[1]?.trim();
}
if (!token) {
  console.error("Missing GH_TOKEN in .env.local");
  process.exit(1);
}

const remote = `https://x-access-token:${token}@github.com/danielhdz4-ai/plataformadeinversion.git`;
const r = spawnSync("git", ["push", remote, "HEAD:main"], {
  cwd: root,
  stdio: "inherit",
  shell: false,
});
process.exit(r.status ?? 1);
