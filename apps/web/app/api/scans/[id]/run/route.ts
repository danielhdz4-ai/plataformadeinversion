import { isOpenAccess } from "@/lib/open-access";
import { runScanForPolygon } from "@/lib/scan/runScan";
import type { ScanPolygon } from "@/lib/scan/types";
import { getDbClient, requireAppUser } from "@/lib/supabase/request-client";
import { NextResponse } from "next/server";

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
    .select("polygon, filters")
    .eq("id", id)
    .single();
  if (error || !scanRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const count = await runScanForPolygon(
      id,
      scanRow.polygon as ScanPolygon,
      (scanRow.filters ?? {}) as { priceMin?: number; priceMax?: number; bedroomsMin?: number }
    );
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "run failed" },
      { status: 500 }
    );
  }
}
