/** Push main usando token con scope workflow (GITHUB_WORKFLOW_TOKEN o GH_TOKEN). */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = join(root, ".env.local");
const raw = readFileSync(envPath, "utf8");
function pick(name) {
  const m = raw.match(new RegExp(`^${name}=(.+)$`, "m"));
  return m?.[1]?.trim().replace(/^["']|["']$/g, "");
}
const token =
  process.env.GITHUB_WORKFLOW_TOKEN?.trim() ||
  process.env.GH_TOKEN?.trim() ||
  pick("GITHUB_WORKFLOW_TOKEN") ||
  pick("GH_TOKEN");
if (!token) {
  console.error("Missing GITHUB_WORKFLOW_TOKEN or GH_TOKEN in .env.local");
  process.exit(1);
}

const remote = `https://x-access-token:${token}@github.com/danielhdz-ai/plataformadeinversion.git`;
const r = spawnSync("git", ["push", remote, "HEAD:main"], {
  cwd: root,
  stdio: "inherit",
  shell: false,
});
if (r.status !== 0) {
  console.error(
    "Push failed. El PAT debe incluir scope workflow para subir .github/workflows."
  );
}
process.exit(r.status ?? 1);
