/**
 * Push commits con .github/workflows (requiere GH_TOKEN scope workflow en danielhdz4-ai).
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
let token = process.env.GH_TOKEN;
if (!token) {
  const raw = readFileSync(join(root, ".env.local"), "utf8");
  token = raw.match(/^GH_TOKEN=(.+)$/m)?.[1]?.trim();
}
if (!token) {
  console.error("Missing GH_TOKEN");
  process.exit(1);
}

const res = await fetch("https://api.github.com/user", {
  headers: { Authorization: `token ${token}`, "User-Agent": "pi-ops" },
});
const scopes = res.headers.get("x-oauth-scopes") ?? "";
if (!scopes.includes("workflow")) {
  console.error(
    JSON.stringify({
      ok: false,
      error: "GH_TOKEN needs workflow scope on danielhdz4-ai",
      scopes,
      fix: "GitHub Settings → Developer settings → PAT → enable workflow, update .env.local GH_TOKEN",
    })
  );
  process.exit(1);
}

const remote = `https://x-access-token:${token}@github.com/danielhdz4-ai/plataformadeinversion.git`;
const r = spawnSync("git", ["push", remote, "HEAD:main"], { cwd: root, stdio: "inherit" });
process.exit(r.status ?? 1);
