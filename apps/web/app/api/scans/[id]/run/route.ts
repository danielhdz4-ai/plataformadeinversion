import { runScanForPolygon } from "@/lib/scan/runScan";
import type { ScanPolygon } from "@/lib/scan/types";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  const supabase = await createClient();
  if (!isCron) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: scan } = await supabase.from("scans").select("user_id").eq("id", id).single();
    if (!scan || scan.user_id !== user.id) {
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
