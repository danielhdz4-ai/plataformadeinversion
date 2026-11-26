/**
 * Push main al repo canónico con un token válido de `gh` (cuenta canónica
 * danielhdz4-ai debe tener scope `repo` + `workflow`).
 * Orden: GH_TOKEN de .env.local → gh auth token (cuentas con `workflow`).
 */
import { spawnSync } from "node:child_process";
import {
  authenticatedRemoteUrl,
  readGithubToken,
  repoRoot,
  resolveGithubRepo,
} from "./lib/github-remote.mjs";

function ghToken(user) {
  const args = ["auth", "token"];
  if (user) args.push("--user", user);
  const r = spawnSync("gh", args, { encoding: "utf8", shell: false });
  const t = (r.stdout ?? "").trim();
  return r.status === 0 && t ? t : null;
}

const repo = resolveGithubRepo();
const candidates = [
  ...new Set(
    [readGithubToken(), ghToken(), ghToken("danielhdz3-ai"), ghToken("danielhdz-ai")].filter(Boolean)
  ),
];

if (candidates.length === 0) {
  console.error("No hay token válido (GH_TOKEN ni gh auth).");
  process.exit(1);
}

for (const token of candidates) {
  console.log(`push HEAD -> main en ${repo} (token …${token.slice(-4)})`);
  const r = spawnSync("git", ["push", authenticatedRemoteUrl(token, repo), "HEAD:main"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
  });
  if (r.status === 0) process.exit(0);
}
console.error("Push falló con todos los tokens disponibles.");
process.exit(1);
