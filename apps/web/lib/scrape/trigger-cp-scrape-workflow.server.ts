import {
  dispatchGithubWorkflow,
  resolveGithubDispatchToken,
} from "@/lib/ops/github-dispatch.server";

/**
 * Scrape profundo por CP en GitHub Actions (sin límite de tiempo de Vercel).
 * Devuelve false si no hay token o el repo/workflow no acepta el dispatch.
 */
export async function triggerPostalCodeScrapeWorkflow(
  postalCode: string
): Promise<boolean> {
  const cp = postalCode.replace(/\D/g, "").slice(0, 5);
  if (cp.length !== 5) return false;
  if (!resolveGithubDispatchToken()) return false;

  const r = await dispatchGithubWorkflow("scrape-postal-code-dispatch.yml", {
    postal_code: cp,
  });
  return r.ok;
}

export function shouldOffloadCpScrapeToActions(): boolean {
  if (process.env.CP_SCRAPE_USE_ACTIONS === "0") return false;
  if (process.env.CP_SCRAPE_USE_ACTIONS === "1") return true;
  return process.env.VERCEL === "1";
}
