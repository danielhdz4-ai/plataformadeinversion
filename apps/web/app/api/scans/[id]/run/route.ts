import { isOpenAccess } from "@/lib/open-access";
import {
  completeScanAfterIngest,
  resolveScanPortals,
} from "@/lib/scan/complete-scan-after-ingest";
import {
  shouldOffloadScanIngestToActions,
  triggerScanZoneIngestWorkflow,
} from "@/lib/scan/trigger-zone-ingest-workflow.server";
import { normalizeScanFilters } from "@/lib/scan/apply-scan-filters";
import type { ScanPolygon } from "@/lib/scan/types";
import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";
import {
  prefetchScanZoneInventory,
  precomputeRoiForPolygon,
} from "@/lib/scrape/prefetch-scan-zone.server";
import { refreshPostalCodeLive } from "@/lib/scrape/scrape-postal-code.server";
import { geocodeSpainQuery, reverseGeocodeSpain } from "@/lib/map/geocode-spain";
import { portalsForCpLiveImport } from "@/lib/scrape/cp-live-portals";
import { promiseWithTimeout } from "@/lib/ops/promise-timeout";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDbClient, requireAppUser } from "@/lib/supabase/request-client";
import { after, NextResponse } from "next/server";

/** Importación por barrio (Fotocasa + pisos.com) puede tardar varios minutos. */
export const maxDuration = 300;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const forceFinish = new URL(req.url).searchParams.get("force") === "1";
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
    .select("polygon, filters, operation, status, progress_pct")
    .eq("id", id)
    .single();
  if (error || !scanRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const polygon = scanRow.polygon as ScanPolygon;
  const filters = (scanRow.filters ?? {}) as ScanRunFilters;
  normalizeScanFilters(filters as Record<string, unknown>);
  const portals = resolveScanPortals(filters);

  const prevStatus = scanRow.status as string | undefined;
  const prevProgress = (scanRow.progress_pct as number | undefined) ?? 0;
  if (prevStatus === "completed") {
    return NextResponse.json({ ok: true, status: "completed" }, { status: 200 });
  }
  if (forceFinish && (prevStatus === "running" || prevStatus === "pending")) {
    after(async () => {
      try {
        await completeScanAfterIngest(
          id,
          polygon,
          filters,
          scanRow.operation ?? "buy_to_rent",
          { ok: false, error: "force_finish" }
        );
      } catch (e) {
        console.error("scan force finish", id, e);
      }
    });
    return NextResponse.json({ ok: true, status: "running", forceFinish: true }, { status: 202 });
  }

  if (prevStatus === "running" && prevProgress > 4) {
    return NextResponse.json({ ok: true, status: "running", deduped: true }, { status: 202 });
  }

  await supabase.from("scans").update({ status: "running", progress_pct: 5 }).eq("id", id);

  let actionsDispatched = false;
  if (shouldOffloadScanIngestToActions()) {
    actionsDispatched = await triggerScanZoneIngestWorkflow(id);
  }

  let scanPostalCode: string | undefined;
  try {
    const ring = polygon.coordinates[0];
    if (ring?.length) {
      const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
      const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
      const rev = await reverseGeocodeSpain(lat, lng);
      let cp = rev?.label.match(/\b(\d{5})\b/)?.[1];
      if (!cp) {
        const hits = await geocodeSpainQuery(`${lat.toFixed(5)},${lng.toFixed(5)}`);
        cp = hits[0]?.label.match(/\b(\d{5})\b/)?.[1];
      }
      if (cp) scanPostalCode = cp;
    }
  } catch (e) {
    console.warn("scan resolve cp", id, e);
  }

  if (actionsDispatched) {
    await supabase
      .from("scans")
      .update({
        progress_pct: 12,
        error_message:
          "Scrape en curso en la nube + importación profunda en GitHub Actions. La página se actualiza sola.",
      })
      .eq("id", id);
  }

  const postalCodeForAfter = scanPostalCode;
  const cpScrapeMs = Number(process.env.SCAN_CP_SCRAPE_TIMEOUT_MS ?? "45_000");
  const ingestMs = Number(process.env.SCAN_INGEST_TIMEOUT_MS ?? "120_000");

  after(async () => {
    const admin = createAdminClient();
    let ingest: Awaited<ReturnType<typeof prefetchScanZoneInventory>> = {
      ok: false,
      reason: "not_started",
    };
    try {
      if (postalCodeForAfter) {
        try {
          await admin
            .from("scans")
            .update({
              progress_pct: 8,
              error_message: "Scrape en vivo (CP) antes del ranking…",
            })
            .eq("id", id);
          await promiseWithTimeout(
            refreshPostalCodeLive(postalCodeForAfter, {
              portals: portalsForCpLiveImport(),
              force: true,
            }),
            cpScrapeMs,
            "cp_scrape_timeout"
          );
        } catch (e) {
          console.warn("scan cp scrape", id, e);
        }
      }

      await admin
        .from("scans")
        .update({ progress_pct: 15, error_message: "Importando anuncios del barrio (portales)…" })
        .eq("id", id);

      try {
        if (actionsDispatched) {
          ingest = { ok: true, skipped: true, reason: "github_actions_ingest" };
        } else {
          ingest = await promiseWithTimeout(
            prefetchScanZoneInventory(polygon, {
              scanId: id,
              portals,
              postalCode: postalCodeForAfter,
            }),
            ingestMs,
            "ingest_timeout"
          );
        }
        console.info("zone ingest", id, ingest);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ingest = { ok: false, error: msg };
        console.error("zone ingest throw", id, e);
        // Solo logs internos: el usuario ve progreso, nunca el error técnico.
        await admin
          .from("scans")
          .update({ progress_pct: 40 })
          .eq("id", id);
      }

      await admin.from("scans").update({ progress_pct: 55 }).eq("id", id);
      try {
        precomputeRoiForPolygon(polygon);
      } catch (e) {
        console.warn("precompute roi skipped", id, e);
      }

      await completeScanAfterIngest(
        id,
        polygon,
        filters,
        scanRow.operation ?? "buy_to_rent",
        ingest
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try {
        await completeScanAfterIngest(
          id,
          polygon,
          filters,
          scanRow.operation ?? "buy_to_rent",
          { ok: false, error: msg }
        );
      } catch (e2) {
        console.error("scan complete fallback failed", id, e2);
        await admin
          .from("scans")
          .update({
            status: "failed",
            progress_pct: 0,
            error_message: null,
          })
          .eq("id", id);
      }
      console.error("scan run failed", id, e);
    }
  });

  return NextResponse.json({ ok: true, status: "running", ingest: "vercel" }, { status: 202 });
}
