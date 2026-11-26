/**
 * Helper común de push con PAT (GH_TOKEN) al repo canónico.
 * Repo canónico: `plataformadeinversion` en la cuenta del PAT (`danielhdz4-ai`).
 * Override: GITHUB_REPOSITORY=owner/repo
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const CANONICAL_GITHUB_REPO = "danielhdz4-ai/plataformadeinversion";

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export function readGithubToken() {
  const fromEnv = process.env.GH_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  try {
    const raw = readFileSync(join(repoRoot, ".env.local"), "utf8");
    const m = raw.match(/^GH_TOKEN=(.+)$/m);
    return m?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

export function resolveGithubRepo() {
  return process.env.GITHUB_REPOSITORY?.trim() || CANONICAL_GITHUB_REPO;
}

/** Remote URL autenticado con PAT, sin exponer el token en logs de git. */
export function authenticatedRemoteUrl(token, repo = resolveGithubRepo()) {
  return `https://x-access-token:${token}@github.com/${repo}.git`;
}
