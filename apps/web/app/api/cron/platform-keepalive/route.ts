import { isCronAuthorized } from "@/lib/ops/authorize-cron";
import { probeSupabase, supabaseHostFromEnv } from "@/lib/ops/verify-supabase";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron: despierta Supabase + comprueba que la BD responde.
 * Programar cada 4–6 h para reducir pausas por inactividad en free tier.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const probe = await probeSupabase();
  const body = {
    ok: probe.reachable && probe.listingsOk,
    keepalive: true,
    host: supabaseHostFromEnv(),
    listingsCount: probe.listingsCount,
    error: probe.error,
    at: new Date().toISOString(),
  };

  if (!body.ok) {
    console.error("[platform-keepalive]", JSON.stringify(body));
    return NextResponse.json(body, { status: 503 });
  }

  return NextResponse.json(body);
}