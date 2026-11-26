import { probeSupabase, supabaseHostFromEnv } from "@/lib/ops/verify-supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Estado plataforma — monitor externo debe esperar HTTP 200 y `ok: true`. */
export async function GET() {
  const host = supabaseHostFromEnv();
  const probe = await probeSupabase();

  let spatialRpcReady = false;
  let lastScrapeRun: { started_at: string; status: string } | null = null;
  let schemaError: string | null = probe.error;

  if (probe.reachable) {
    try {
      const admin = createAdminClient();
      const { data: runs } = await admin
        .from("scrape_runs")
        .select("started_at, status")
        .order("started_at", { ascending: false })
        .limit(1);
      lastScrapeRun = runs?.[0] ?? null;

      if ((probe.listingsCount ?? 0) > 0) {
        const { data: sample } = await admin
          .from("listings")
          .select("id")
          .eq("operation", "sale")
          .not("geom", "is", null)
          .limit(1)
          .maybeSingle();
        if (sample?.id) {
          const { error: rpcErr } = await admin.rpc("rent_comparables_near", {
            p_listing_id: sample.id,
            max_m: 1200,
            lim: 1,
          });
          spatialRpcReady = !rpcErr;
        }
      }
    } catch (e) {
      schemaError = e instanceof Error ? e.message : String(e);
    }
  }

  const schemaReady = probe.listingsOk && (probe.listingsCount ?? 0) > 0;
  const platformOk = probe.configured && probe.reachable && probe.listingsOk;

  const payload = {
    ok: platformOk && schemaReady,
    db: probe.reachable && probe.listingsOk,
    reachable: probe.reachable,
    configured: probe.configured,
    supabaseHost: host,
    schemaReady,
    spatialRpcReady,
    schemaError,
    error: probe.error,
    version: "0.1.0",
    listingsCount: probe.listingsCount,
    lastScrapeRun,
    openAccess: process.env.OPEN_ACCESS === "1" || process.env.NEXT_PUBLIC_OPEN_ACCESS === "1",
    at: new Date().toISOString(),
  };

  if (!probe.configured || !probe.reachable) {
    return NextResponse.json(payload, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return NextResponse.json(payload, {
    status: schemaReady ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}