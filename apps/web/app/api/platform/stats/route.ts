import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = createAdminClient();
  const { data: byPortal } = await admin
    .from("listings")
    .select("source_portal")
    .eq("operation", "sale")
    .eq("status", "active");
  const portalCounts = (byPortal ?? []).reduce<Record<string, number>>((acc, row) => {
    const k = row.source_portal as string;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

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
    .select("source, status, started_at, listings_inserted")
    .order("started_at", { ascending: false })
    .limit(8);
  const { data: coverage } = await admin.from("coverage_regions").select("slug, last_scrape_at, tier");

  return NextResponse.json({
    listings: {
      saleActive: saleActive.count ?? 0,
      rentActive: rentActive.count ?? 0,
      saleByPortal: portalCounts,
    },
    scrapeRuns: runs ?? [],
    coverage: coverage ?? [],
  });
}
