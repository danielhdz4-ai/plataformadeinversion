import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const admin = createAdminClient();
    const { count, error: listingsErr } = await admin
      .from("listings")
      .select("id", { count: "exact" })
      .limit(1);
    const { error: runsErr } = await admin.from("scrape_runs").select("id").limit(1);

    const tablesOk = !listingsErr && !runsErr;
    const listingsCount = tablesOk ? (count ?? 0) : null;
    const schemaReady = tablesOk && (count ?? 0) > 0;

    const { data: runs } = tablesOk
      ? await admin
          .from("scrape_runs")
          .select("started_at, status")
          .order("started_at", { ascending: false })
          .limit(1)
      : { data: null };

    let spatialRpcReady = false;
    if (tablesOk && (count ?? 0) > 0) {
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
          max_m: 500,
          lim: 1,
        });
        spatialRpcReady = !rpcErr;
      }
    }

    return NextResponse.json({
      ok: schemaReady,
      db: true,
      schemaReady,
      spatialRpcReady,
      schemaError: listingsErr?.message ?? runsErr?.message ?? null,
      version: "0.1.0",
      listingsCount,
      lastScrapeRun: runs?.[0] ?? null,
      openAccess: process.env.OPEN_ACCESS === "1" || process.env.NEXT_PUBLIC_OPEN_ACCESS === "1",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, db: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 503 }
    );
  }
}
