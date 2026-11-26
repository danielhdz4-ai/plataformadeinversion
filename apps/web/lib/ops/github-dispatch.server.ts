/**
 * Dispatch de workflows de GitHub Actions desde Vercel.
 * Repo canónico: `plataformadeinversion` en la cuenta del PAT (override con GITHUB_REPOSITORY).
 */

/** Repo con workflows de scrape/ingest (debe existir y tener scope `workflow`). */
export const CANONICAL_GITHUB_REPO = "danielhdz4-ai/plataformadeinversion";

export function resolveGithubDispatchRepo(): string {
  return process.env.GITHUB_REPOSITORY?.trim() || CANONICAL_GITHUB_REPO;
}

export function resolveGithubDispatchToken(): string | null {
  const token = process.env.GITHUB_WORKFLOW_TOKEN ?? process.env.GH_TOKEN;
  return token?.trim() ? token.trim() : null;
}

/**
 * POST workflow_dispatch. Devuelve ok=true si GitHub acepta el run (204).
 * Logs el motivo exacto si falla (404 repo, 403 token, 422 inputs/yml ausente).
 */
export async function dispatchGithubWorkflow(
  workflowFile: string,
  inputs: Record<string, string>,
  options?: { ref?: string; repo?: string; token?: string }
): Promise<{ ok: boolean; status: number; detail?: string }> {
  const token = options?.token ?? resolveGithubDispatchToken();
  if (!token) return { ok: false, status: 0, detail: "missing_token" };

  const repo = options?.repo ?? resolveGithubDispatchRepo();
  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) return { ok: false, status: 0, detail: "bad_repo" };

  const ref = options?.ref ?? process.env.GITHUB_WORKFLOW_REF?.trim() ?? "main";
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref, inputs }),
    }
  );

  if (res.status === 204) return { ok: true, status: 204 };
  const body = await res.text().catch(() => "");
  const detail = body.slice(0, 400);
  console.error(`github dispatch ${owner}/${repoName} ${workflowFile} failed`, res.status, detail);
  return { ok: false, status: res.status, detail };
}
