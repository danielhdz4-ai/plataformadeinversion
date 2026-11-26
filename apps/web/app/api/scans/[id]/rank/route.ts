import { isOpenAccess } from "@/lib/open-access";
import { publicDbError } from "@/lib/ops/db-api-errors";
import { completeScanAfterIngest } from "@/lib/scan/complete-scan-after-ingest";
import type { ScanPolygon } from "@/lib/scan/types";
import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";
import type { ScanZoneIngestResult } from "@/lib/scrape/prefetch-scan-zone.server";
import { getDbClient, requireAppUser } from "@/lib/supabase/request-client";
import { NextResponse } from "next/server";
import { z } from "zod";

export const maxDuration = 120;

const bodySchema = z.object({
  ingest: z
    .object({
      ok: z.boolean().optional(),
      error: z.string().optional(),
      inPolygonAfter: z.number().optional(),
      target: z.number().optional(),
      meetsTarget: z.boolean().optional(),
    })
    .optional(),
});

/** Ranking ROI tras ingest (GitHub Actions o reintento manual). */
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

  let ingestMeta: Pick<
    ScanZoneIngestResult,
    "ok" | "error" | "inPolygonAfter" | "target" | "meetsTarget"
  > = {};
  const raw = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (parsed.success && parsed.data.ingest) ingestMeta = parsed.data.ingest;

  try {
    await completeScanAfterIngest(
      id,
      scanRow.polygon as ScanPolygon,
      (scanRow.filters ?? {}) as ScanRunFilters,
      scanRow.operation ?? "buy_to_rent",
      ingestMeta
    );
    return NextResponse.json({ ok: true, status: "completed" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: publicDbError("api/scans/rank", msg, {
          userMessage: "No se pudo completar el ranking. Inténtalo de nuevo.",
        }),
      },
      { status: 500 }
    );
  }
}
