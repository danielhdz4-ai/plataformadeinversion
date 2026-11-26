import {
  dispatchGithubWorkflow,
  resolveGithubDispatchToken,
} from "@/lib/ops/github-dispatch.server";

/** Dispara workflow `scan-zone-ingest.yml` (ingest largo fuera de Vercel). */
export async function triggerScanZoneIngestWorkflow(scanId: string): Promise<boolean> {
  if (!scanId) return false;
  if (!resolveGithubDispatchToken()) return false;

  const r = await dispatchGithubWorkflow("scan-zone-ingest.yml", { scan_id: scanId });
  return r.ok;
}

export function shouldOffloadScanIngestToActions(): boolean {
  if (process.env.SCAN_INGEST_USE_ACTIONS === "0") return false;
  if (process.env.SCAN_INGEST_USE_ACTIONS === "1") return true;
  if (process.env.VERCEL !== "1") return false;
  return Boolean(resolveGithubDispatchToken());
}
