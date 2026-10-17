import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = createAdminClient();
  const portalCounts: Record<string, number> = {};
  for (const portal of [
    "kelify",
    "pisos_com",
    "pisos.com",
    "pisos",
    "hipoges",
    "solvia",
    "fotocasa",
    "habitaclia",
    "idealista",
  ]) {
    const { count } = await admin
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("operation", "sale")
      .eq("status", "active")
      .eq("source_portal", portal);
    if ((count ?? 0) > 0) portalCounts[portal] = count ?? 0;
  }

  const saleActive = await admin
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("operation", "sale")
    .eq("status", "active");
  const rentActive = await admin
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("operation", "rent")
    .eq("status", "active");
  const { data: runs } = await admin
    .from("scrape_runs")
    .select("source, status, started_at, finished_at, listings_inserted")
    .order("started_at", { ascending: false })
    .limit(24);
  const lastCompleted =
    (runs ?? []).find((r) => r.status === "completed" || r.status === "failed") ?? null;
  const lastRunning = (runs ?? []).find((r) => r.status === "running") ?? null;
  const { data: coverage } = await admin.from("coverage_regions").select("slug, last_scrape_at, tier");

  return NextResponse.json({
    listings: {
      saleActive: saleActive.count ?? 0,
      rentActive: rentActive.count ?? 0,
      saleByPortal: portalCounts,
    },
    scrapeRuns: runs ?? [],
    lastScrape: lastCompleted,
    scrapeInProgress: lastRunning,
    coverage: coverage ?? [],
  });
}
