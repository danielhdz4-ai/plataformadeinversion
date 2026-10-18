import { isOpenAccess } from "@/lib/open-access";
import { prefetchScanZoneInventory } from "@/lib/scrape/prefetch-scan-zone.server";
import { runScanForPolygon } from "@/lib/scan/runScan";
import type { ScanPolygon } from "@/lib/scan/types";
import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDbClient, requireAppUser } from "@/lib/supabase/request-client";
import { after, NextResponse } from "next/server";

/** Prefetch de portales puede tardar 1–3 min (barrios cercanos al radio del scan). */
export const maxDuration = 300;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  const supabase = await getDbClient();
  if (!isCron && !isOpenAccess()) {
    const auth = await requireAppUser();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { data: scan } = await supabase.from("scans").select("user_id").eq("id", id).single();
    if (!scan || scan.user_id !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: scanRow, error } = await supabase
    .from("scans")
    .select("polygon, filters, operation")
    .eq("id", id)
    .single();
  if (error || !scanRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const polygon = scanRow.polygon as ScanPolygon;
  const filters = (scanRow.filters ?? {}) as ScanRunFilters;

  await supabase.from("scans").update({ status: "running", progress_pct: 5 }).eq("id", id);

  after(async () => {
    const admin = createAdminClient();
    try {
      await admin.from("scans").update({ progress_pct: 12 }).eq("id", id);
      try {
        const prefetch = await prefetchScanZoneInventory(polygon);
        console.info("scan prefetch", id, prefetch);
      } catch (prefetchErr) {
        console.warn("scan prefetch failed (continuing)", id, prefetchErr);
      }
      await admin.from("scans").update({ progress_pct: 45 }).eq("id", id);
      await runScanForPolygon(id, polygon, filters, scanRow.operation ?? "buy_to_rent");
    } catch (e) {
      await admin
        .from("scans")
        .update({ status: "failed", progress_pct: 0 })
        .eq("id", id);
      console.error("scan run failed", id, e);
    }
  });

  return NextResponse.json({ ok: true, status: "running" }, { status: 202 });
}
