import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const admin = createAdminClient();
    const { count } = await admin.from("listings").select("*", { count: "exact", head: true });
    const { data: runs } = await admin
      .from("scrape_runs")
      .select("started_at, status")
      .order("started_at", { ascending: false })
      .limit(1);
    return NextResponse.json({
      ok: true,
      db: true,
      version: "0.1.0",
      listingsCount: count ?? 0,
      lastScrapeRun: runs?.[0] ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, db: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 503 }
    );
  }
}
