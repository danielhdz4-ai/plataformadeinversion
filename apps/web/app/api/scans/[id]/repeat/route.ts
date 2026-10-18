import { openAccessUserId } from "@/lib/open-access";
import { runScanForPolygon } from "@/lib/scan/runScan";
import type { ScanPolygon } from "@/lib/scan/types";
import { getDbClient, requireAppUser } from "@/lib/supabase/request-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { after, NextResponse } from "next/server";
import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";

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

  const polygon = source.polygon as ScanPolygon;
  const filters = (source.filters ?? {}) as ScanRunFilters;

  await supabase.from("scans").update({ status: "running", progress_pct: 5 }).eq("id", created.id);

  after(async () => {
    const admin = createAdminClient();
    try {
      await runScanForPolygon(
        created.id,
        polygon,
        filters,
        source.operation ?? "buy_to_rent"
      );
    } catch (e) {
      await admin.from("scans").update({ status: "failed", progress_pct: 0 }).eq("id", created.id);
      console.error("scan repeat failed", created.id, e);
    }
  });

  return NextResponse.json({ scanId: created.id, ok: true, status: "running" }, { status: 202 });
}
