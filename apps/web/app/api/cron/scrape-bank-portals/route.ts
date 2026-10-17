import { spawn } from "node:child_process";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function runJob(env: Record<string, string>) {
  const root = path.join(process.cwd(), "../..");
  const script = path.join(root, "scripts/jobs/scrape-bank-portals-spain.mjs");
  return new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout?.on("data", (c) => {
      out += String(c);
    });
    child.stderr?.on("data", (c) => {
      out += String(c);
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      console.log("[cron scrape-bank-portals]", out.slice(-4000));
      resolve({ code, signal });
    });
  });
}

/** Vercel Cron: ingestión Hipoges + Solvia (lote acotado por timeout). */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const max = process.env.CRON_BANK_MAX_LISTINGS ?? "120";
  const { code } = await runJob({
    MAX_LISTINGS: max,
    SOLVIA_MAX_PAGES: "6",
    HIPOGES_PAGE_SIZE: "30",
    PAUSE_MS: "400",
  });
  return NextResponse.json({
    ok: code === 0,
    exitCode: code,
    maxListings: max,
  });
}
