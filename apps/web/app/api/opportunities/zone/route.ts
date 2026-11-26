import { loadZoneOpportunityFeed } from "@/lib/opportunities/load-zone-feed.server";
import { circlePolygon } from "@/lib/map/circle-polygon";
import {
  geocodeSpainQuery,
  normalizeSpanishPostalCode,
  reverseGeocodeSpain,
} from "@/lib/map/geocode-spain";
import { ZONE_STOCK_TARGET } from "@/lib/map/cp-zone-stock";
import { ensureCpStockIngest } from "@/lib/scrape/ensure-cp-stock.server";
import { cpStockBaseRadiusM } from "@/lib/map/cp-priority";
import { promiseWithTimeout } from "@/lib/ops/promise-timeout";
import {
  countFreshAround,
  cpExactRadiusM,
  cpRadiusFromBbox,
} from "@/lib/map/cp-area-listings.server";
import { prefetchScanZoneInventory } from "@/lib/scrape/prefetch-scan-zone.server";
import { portalsForCpLiveImport } from "@/lib/scrape/cp-live-portals";
import { refreshPostalCodeLive } from "@/lib/scrape/scrape-postal-code.server";
import {
  dbErrorFromUnknown,
  ensureSupabaseReachable,
  isLikelyUnreachable,
  publicDbError,
  unreachableSupabasePayload,
} from "@/lib/ops/db-api-errors";
import { probeSupabase } from "@/lib/ops/verify-supabase";
import { getDbClient, requireAppUser } from "@/lib/supabase/request-client";
import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const maxDuration = 300;

const bodySchema = z.object({
  lat: z.number(),
  lng: z.number(),
  cp: z.string().optional(),
  radiusM: z.number().optional(),
  limit: z.number().optional(),
  live: z.boolean().optional(),
  /** Esperar scrape CP antes de responder (más lento, más stock). */
  waitScrape: z.boolean().optional(),
  chollosOnly: z.boolean().optional(),
  label: z.string().optional(),
  offset: z.number().optional(),
  maxAgeDays: z.number().optional(),
  /** bbox del CP/barrio elegido: ajusta el radio para que el área coincida. */
  cpBbox: z
    .tuple([z.number(), z.number(), z.number(), z.number()])
    .nullable()
    .optional(),
});

async function resolveCp(lat: number, lng: number, cpHint?: string): Promise<string> {
  const normalized = cpHint ? normalizeSpanishPostalCode(cpHint.replace(/\D/g, "").slice(0, 5)) : null;
  if (normalized) return normalized;
  const rev = await reverseGeocodeSpain(lat, lng);
  const fromRev = rev?.label.match(/\b(\d{5})\b/)?.[1];
  if (fromRev) return fromRev;
  const hits = await geocodeSpainQuery(`${lat.toFixed(5)},${lng.toFixed(5)}`);
  const pc = hits[0]?.label.match(/\b(\d{5})\b/)?.[1];
  if (pc) return pc;
  throw new Error("No se pudo resolver código postal para esta zona");
}

export async function POST(req: NextRequest) {
  const auth = await requireAppUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, code: "AUTH" }, { status: auth.status });
  }

  const reach = await ensureSupabaseReachable();
  if (!reach.ok) {
    return NextResponse.json(reach.body, { status: reach.status });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Los datos de la zona no son válidos.", code: "VALIDATION" }, { status: 400 });
  }

  const { lat, lng, waitScrape, chollosOnly } = parsed.data;  const limit = Math.min(400, parsed.data.limit ?? 400);
  const cp = await resolveCp(lat, lng, parsed.data.cp);
  const cpBbox = parsed.data.cpBbox ?? null;
  const requestedRadius =
    parsed.data.radiusM ??
    cpRadiusFromBbox(cp, cpBbox, cpStockBaseRadiusM(cp, 6500));
  const live = parsed.data.live !== false;

  /**
   * Zona fría: si la última importación de ese CP es antigua (o no hay),
   * refrescamos antes de responder para no servir inventario envejecido.
   */
  let staleRefresh: { ageHours: number | null; refreshed: boolean } | null = null;
  if (live && parsed.data.cp) {
    try {
      const { cpLastScrapeHours, coldZoneHours } = await import(
        "@/lib/opportunities/cp-freshness.server"
      );
      const ageHours = await cpLastScrapeHours(cp);
      if (ageHours == null || ageHours >= coldZoneHours()) {
        staleRefresh = { ageHours, refreshed: false };
      }
      console.info("cp cold zone", cp, { ageHours, cold: Boolean(staleRefresh) });
    } catch (e) {
      console.warn("cp freshness check", cp, e);
    }
  }

  let scrapeMeta: Awaited<ReturnType<typeof refreshPostalCodeLive>> | null = null;
  let refreshStarted = false;
  let radiusM = requestedRadius;

  const runBackgroundIngest = () => {
    refreshStarted = true;
    after(async () => {
      try {
        await ensureCpStockIngest(cp, { forceScrape: true });
        const portals = portalsForCpLiveImport();
        const polygon = circlePolygon(lng, lat, radiusM / 1000);
        await prefetchScanZoneInventory(polygon, {
          portals: [...portals, "hipoges", "solvia"],
          postalCode: cp,
        });
      } catch (e) {
        console.error("zone opportunity ingest", e);
      }
    });
  };

  if (live && (waitScrape || staleRefresh)) {
    try {
      const coldMs = Number(process.env.CP_COLD_ZONE_TIMEOUT_MS ?? "60000");
      const ingested = await promiseWithTimeout(
        ensureCpStockIngest(cp, { forceScrape: true }),
        coldMs,
        "cold_zone_timeout"
      );
      scrapeMeta = ingested.scrape ?? null;
      if (staleRefresh) staleRefresh.refreshed = Boolean(ingested.scrapeStarted);
      const polygon = circlePolygon(lng, lat, radiusM / 1000);
      await promiseWithTimeout(
        prefetchScanZoneInventory(polygon, {
          portals: ["fotocasa", "pisos_com", "kelify", "hipoges", "solvia", "habitaclia"],
          postalCode: cp,
        }),
        Number(process.env.CP_COLD_ZONE_INGEST_MS ?? "90000"),
        "cold_zone_ingest"
      );
    } catch (e) {
      scrapeMeta = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  const supabase = await getDbClient();
  try {
    const maxAgeDays = parsed.data.maxAgeDays ?? 14;
    /** Si hay bbox de CP, el inventario cercano manda: evita "0 de 180" por índices urbanos. */
    if (cpBbox) {
      const around = await countFreshAround(supabase, cp, lat, lng, {
        radiusM: requestedRadius,
        freshDays: maxAgeDays,
      });
      radiusM = Math.max(requestedRadius, cpExactRadiusM(requestedRadius, around.exact));
    }

    let feed = await loadZoneOpportunityFeed(supabase, {
      lat,
      lng,
      cp,
      radiusM,
      limit,
      offset: parsed.data.offset ?? 0,
      maxAgeDays,
      chollosOnly: chollosOnly !== false,
    });

    if (live && waitScrape && feed.items.length < 15) {
      feed = await loadZoneOpportunityFeed(supabase, {
        lat,
        lng,
        cp,
        radiusM: Math.min(12_000, radiusM + 2000),
        limit,
        offset: parsed.data.offset ?? 0,
        maxAgeDays,
        chollosOnly: chollosOnly !== false,
      });
    }

    const needsDeep = live && !waitScrape;
    if (needsDeep) {
      if (feed.totalInZone < ZONE_STOCK_TARGET) runBackgroundIngest();
    }

    return NextResponse.json({
      ...feed,
      center: { lat, lng },
      label: parsed.data.label ?? null,
      source: "zone" as const,
      liveImport: Boolean(waitScrape),
      refreshStarted: refreshStarted || needsDeep,
      scrape: scrapeMeta,
      staleRefresh,
      totalQualified: feed.opportunitiesInZone,
      stockTarget: ZONE_STOCK_TARGET,
      stockSatisfied: feed.totalInZone >= ZONE_STOCK_TARGET,
    });
  } catch (e) {
    const message = dbErrorFromUnknown(e);
    if (isLikelyUnreachable(message)) {
      const probe = await probeSupabase();
      return NextResponse.json(unreachableSupabasePayload(probe), { status: 503 });
    }
    return NextResponse.json({ error: publicDbError("api/opportunities/zone", message), code: "DB" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAppUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, code: "AUTH" }, { status: auth.status });
  }

  const reach = await ensureSupabaseReachable();
  if (!reach.ok) {
    return NextResponse.json(reach.body, { status: reach.status });
  }

  const p = req.nextUrl.searchParams;
  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng required", code: "VALIDATION" }, { status: 400 });
  }
  const cp = p.get("cp") ?? undefined;
  const radiusM = Number(p.get("radiusM") ?? "6500");
  const limit = Math.min(400, Number(p.get("limit") ?? "400"));
  const supabase = await getDbClient();
  const feed = await loadZoneOpportunityFeed(supabase, {
    lat,
    lng,
    cp: await resolveCp(lat, lng, cp ?? undefined),
    radiusM,
    limit,
  });
  return NextResponse.json({ ...feed, source: "zone", totalQualified: feed.opportunitiesInZone });
}
