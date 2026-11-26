/**
 * Push con .github/workflows (requiere GH_TOKEN con scope `workflow`).
 * Repo canónico: danielhdz4-ai/plataformadeinversion (override GITHUB_REPOSITORY).
 */
import { spawnSync } from "node:child_process";
import {
  authenticatedRemoteUrl,
  readGithubToken,
  repoRoot,
  resolveGithubRepo,
} from "./lib/github-remote.mjs";

const token = readGithubToken();
if (!token) {
  console.error("Missing GH_TOKEN in .env.local");
  process.exit(1);
}

/** Scopes del PAT consultados contra la API antes de intentar el push. */
async function oauthScopes(pat) {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${pat}`, "User-Agent": "plataformadeinversion-ops" },
  });
  const header = res.headers.get("x-oauth-scopes") ?? "";
  const login = (await res.json().catch(() => ({})))?.login ?? "?";
  return { ok: res.ok, login, scopes: header.split(",").map((s) => s.trim()).filter(Boolean) };
}

const { ok, login, scopes } = await oauthScopes(token);
if (!ok) {
  console.error(JSON.stringify({ error: "GH_TOKEN inválido o sin permisos", scopes }));
  process.exit(1);
}
if (!scopes.includes("workflow")) {
  console.error(
    JSON.stringify({
      error: "GH_TOKEN needs workflow scope",
      login,
      scopes,
      fix: `github.com/settings/tokens → añadir scope workflow al PAT de ${login}`,
    })
  );
  process.exit(1);
}

const repo = resolveGithubRepo();
console.log(`push HEAD -> main en ${repo} (cuenta ${login}, scopes ${scopes.join(",")})`);
const r = spawnSync("git", ["push", authenticatedRemoteUrl(token, repo), "HEAD:main"], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: false,
});
process.exit(r.status ?? 1);
