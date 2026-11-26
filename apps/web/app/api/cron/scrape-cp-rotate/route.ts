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

function runScript(scriptPath: string, env: Record<string, string>) {
  const root = path.join(process.cwd(), "../..");
  const script = path.join(root, scriptPath);
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
      console.log(`[cron ${scriptPath}]`, out.slice(-6000));
      resolve({ code, signal });
    });
  });
}

function runJob(env: Record<string, string>) {
  return runScript("scripts/jobs/scrape-cp-rotate.mjs", env);
}

function runRoiJob(env: Record<string, string>) {
  return runScript("scripts/jobs/roi-cp-rotate.mjs", env);
}

/**
 * Vercel Cron diario: rotación scrape CP (huecos → rurales → costa → capitales)
 * + recálculo ROI de esos mismos CP. Objetivo stock fresco 80 / 14 días.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const batch = process.env.CRON_CP_BATCH ?? "8";
  const roiBatch = process.env.CRON_CP_ROI_BATCH ?? "12";
  const explicit = req.nextUrl.searchParams.get("cp")?.trim();
  const cpEnv: Record<string, string> = explicit
    ? { CP_LIST: explicit, BATCH_SIZE: String((explicit.split(",").length || 1) + 0) }
    : { BATCH_SIZE: batch };

  const [{ code }, roi] = await Promise.all([
    runJob({
      ...cpEnv,
      PAUSE_MS: process.env.CRON_CP_PAUSE_MS ?? "3500",
      SCAN_CP_DISTRICT_KM: "22",
      SCRAPE_CP_BOOST_ROUNDS: "5",
      SCRAPE_CP_TAG_RADIUS_M: "7500",
    }),
    runRoiJob({
      ...(explicit
        ? { CP_LIST: explicit, BATCH_SIZE: String(explicit.split(",").length || 1) }
        : { BATCH_SIZE: roiBatch }),
      SCAN_CP_DISTRICT_KM: "22",
    }),
  ]);
  return NextResponse.json({
    ok: code === 0,
    exitCode: code,
    batchSize: cpEnv.BATCH_SIZE,
    explicit: Boolean(explicit),
    roiExitCode: roi.code,
  });
}