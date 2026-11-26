import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { ensureFreshRoiForZone } from "@/lib/scrape/ensure-fresh-roi.server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function runScript(scriptPath: string, env: Record<string, string>) {
  const root = path.join(process.cwd(), "../..");
  const script = path.join(root, scriptPath);
  return new Promise<{ code: number | null; out: string }>((resolve, reject) => {
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
    child.on("close", (code) => {
      console.log(`[cron ${scriptPath}]`, out.slice(-6000));
      resolve({ code, out });
    });
  });
}

/**
 * Vercel Cron diario: refresca comparables de ALQUILER de la zona caliente
 * (CPs con más stock fresco) y recalcula ROI en esos mismos CP.
 *
 * Motivo: sin alquiler reciente el ROI cae a benchmark/heurístico (R0/R3) y
 * el ranking de oportunidades deja de ser fiable.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cpList =
    process.env.CRON_CP_SCRAPE_LIST ??
    process.env.CRON_RENT_CP_LIST ??
    "28033,28039,08001,46001,41011,29001,48001,33001";

  const rent = await runScript("scripts/jobs/scrape-rent-cp-rotate.mjs", {
    CP_LIST: cpList,
    MAX_LISTINGS: process.env.CRON_RENT_MAX ?? "60",
    PISOS_MAX_PAGES: process.env.CRON_RENT_PAGES ?? "4",
    PAUSE_MS: process.env.CRON_RENT_PAUSE_MS ?? "2500",
  });

  const roi = await ensureFreshRoiForZone(cpList.split(",").map((c) => c.trim()));

  return NextResponse.json({
    ok: rent.code === 0,
    exitCode: rent.code,
    cps: cpList,
    rent: rent.out.slice(-1500),
    roi,
  });
}
