import { openAccessUserId } from "@/lib/open-access";
import { runScanForPolygon } from "@/lib/scan/runScan";
import type { ScanPolygon } from "@/lib/scan/types";
import { getDbClient, requireAppUser } from "@/lib/supabase/request-client";
import { NextResponse } from "next/server";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: sourceId } = await ctx.params;
  const auth = await requireAppUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, code: "AUTH" }, { status: auth.status });
  }

  const supabase = await getDbClient();
  const { data: source, error: srcErr } = await supabase
    .from("scans")
    .select("polygon, filters, operation, user_id")
    .eq("id", sourceId)
    .single();

  if (srcErr || !source) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (source.user_id !== auth.user.id && auth.user.id !== openAccessUserId()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: created, error: insErr } = await supabase
    .from("scans")
    .insert({
      user_id: auth.user.id || openAccessUserId(),
      polygon: source.polygon,
      filters: source.filters ?? {},
      operation: source.operation ?? "buy_to_rent",
      status: "pending",
    })
    .select("id")
    .single();

  if (insErr || !created) {
    return NextResponse.json({ error: insErr?.message ?? "insert failed" }, { status: 500 });
  }

  try {
    const count = await runScanForPolygon(
      created.id,
      source.polygon as ScanPolygon,
      (source.filters ?? {}) as { priceMin?: number; priceMax?: number; bedroomsMin?: number }
    );
    return NextResponse.json({ scanId: created.id, ok: true, count });
  } catch (e) {
    return NextResponse.json(
      { scanId: created.id, error: e instanceof Error ? e.message : "run failed" },
      { status: 500 }
    );
  }
}
