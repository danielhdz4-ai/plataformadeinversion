import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/** Estado operativo de scrapes (B4) — lectura pública mínima. */
export async function GET() {
  const admin = createAdminClient();
  const { data: runs, error } = await admin
    .from("scrape_runs")
    .select("source, city_slug, status, started_at, finished_at, listings_inserted, error_message")
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: coverage } = await admin
    .from("coverage_regions")
    .select("slug, tier, last_scrape_at")
    .order("tier", { ascending: true });

  return NextResponse.json({
    runs: runs ?? [],
    coverage: coverage ?? [],
  });
}
