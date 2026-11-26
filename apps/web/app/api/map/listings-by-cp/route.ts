import { cleanListingTitle } from "@/lib/listing/display-title";
import { resolveListingSqm } from "@/lib/listing/resolve-sqm";
import { resolveListingGrossRoiPct } from "@/lib/listing/gross-roi";
import { resolveRentEstMonthly } from "@/lib/listing/rent-est";
import { interleaveByPortal } from "@/lib/map/balance-listings-by-portal";
import { cpStockBaseRadiusM } from "@/lib/map/cp-priority";
import { cpRadiusSteps, ZONE_STOCK_TARGET } from "@/lib/map/cp-zone-stock";
import { ensureCpStockIngest } from "@/lib/scrape/ensure-cp-stock.server";
import { listingWithinFreshWindow } from "@/lib/listing/opportunity-qualify";
import { geocodeSpainQuery } from "@/lib/map/geocode-spain";
import { portalsForCpLiveImport } from "@/lib/scrape/cp-live-portals";
import { refreshPostalCodeLive } from "@/lib/scrape/scrape-postal-code.server";
import { fetchListingRowsInChunks } from "@/lib/supabase/fetch-in-chunks";
import { getDbClient, requireAppUser } from "@/lib/supabase/request-client";
import { after, NextRequest, NextResponse } from "next/server";
import { publicDbError } from "@/lib/ops/db-api-errors";

/** Importación en vivo por CP (España) — puede tardar varios minutos. */
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = await requireAppUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, code: "AUTH" }, { status: auth.status });
  }

  const cp = req.nextUrl.searchParams.get("cp")?.trim() ?? "";
  if (!/^(0[1-9]\d{3}|[1-4]\d{4}|5[0-2]\d{3})$/.test(cp)) {
    return NextResponse.json({ error: "CP inválido", code: "VALIDATION" }, { status: 400 });
  }

  const live = req.nextUrl.searchParams.get("live") !== "0";
  const waitForScrape = req.nextUrl.searchParams.get("wait") === "1";
  const maxRows = Number(req.nextUrl.searchParams.get("max") ?? "800");
  const radiusM = Number(
    req.nextUrl.searchParams.get("radiusM") ?? String(cpStockBaseRadiusM(cp))
  );

  const hits = await geocodeSpainQuery(cp);
  const center = hits[0];
  if (!center) {
    return NextResponse.json({ error: "No se pudo geolocalizar el CP", code: "GEOCODE" }, { status: 404 });
  }

  let scrapeMeta: Awaited<ReturnType<typeof refreshPostalCodeLive>> | null = null;
  let refreshStarted = false;

  if (live && !waitForScrape) {
    refreshStarted = true;
    const portals = portalsForCpLiveImport();
    after(async () => {
      try {
        await ensureCpStockIngest(cp, { forceScrape: true });
      } catch (e) {
        console.error("cp scrape background", cp, e);
      }
    });
  } else if (live && waitForScrape) {
    try {
      const portals = portalsForCpLiveImport();
      scrapeMeta = await refreshPostalCodeLive(cp, { portals, force: true });
      if (scrapeMeta.error && !scrapeMeta.ok) {
        return NextResponse.json(
          { error: scrapeMeta.error, code: "SCRAPE", postalCode: cp },
          { status: 502 }
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        {
          error: publicDbError("api/map/listings-by-cp/scrape", msg, {
            userMessage: "No pudimos buscar nuevas viviendas en este momento. Vuelve en unos minutos.",
          }),
          code: "SCRAPE",
          postalCode: cp,
        },
        { status: 502 }
      );
    }
  }

  const supabase = await getDbClient();

  type RpcRow = {
    id: string;
    price: number;
    roi_gross: number | null;
    lng: number;
    lat: number;
    geocode_quality: number | null;
    rent_confidence: string | null;
    source_portal: string;
    postal_code: string | null;
  };

  const merged = new Map<string, RpcRow>();
  const portals = [
    "fotocasa",
    "pisos_com",
    "kelify",
    "habitaclia",
    "hipoges",
    "solvia",
    "idealista",
  ] as const;

  const perPortal = Math.ceil(maxRows / portals.length) + 50;
  let usedRadius = radiusM;
  for (const r of cpRadiusSteps(radiusM)) {
    usedRadius = r;
    await supabase.rpc("tag_listings_postal_code", {
      p_cp: cp,
      p_lng: center.lng,
      p_lat: center.lat,
      p_radius_m: r,
    });
    merged.clear();
    const batches = await Promise.all(
      portals.map(async (portal) => {
        const { data, error } = await supabase.rpc("listings_for_postal_code", {
          p_cp: cp,
          p_lng: center.lng,
          p_lat: center.lat,
          p_radius_m: r,
          max_rows: perPortal,
          portal_filter: portal,
        });
        return { portal, data, error };
      })
    );
    let batchErr: string | null = null;
    for (const { error, data } of batches) {
      if (error) {
        if (/listings_for_postal_code|function/i.test(error.message)) {
          return NextResponse.json(
            { error: "Esta zona aún no está habilitada. Prueba con otro código postal.", code: "MIGRATION" },
            { status: 503 }
          );
        }
        batchErr = error.message;
        break;
      }
      for (const row of (data ?? []) as RpcRow[]) {
        merged.set(row.id, row);
      }
    }
    if (batchErr) {
      return NextResponse.json(
        { error: publicDbError("api/map/listings-by-cp", batchErr), code: "DB" },
        { status: 500 }
      );
    }
    if (merged.size >= ZONE_STOCK_TARGET) break;
  }

  if (live && merged.size < ZONE_STOCK_TARGET) {
    refreshStarted = true;
    after(async () => {
      try {
        await ensureCpStockIngest(cp, { forceScrape: true });
      } catch (e) {
        console.error("cp stock ensure", cp, e);
      }
    });
  }

  const maxAgeDays = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("maxAgeDays") ?? "14")));
  let rows = [...merged.values()].slice(0, maxRows);
  const ids = rows.map((r) => r.id);

  type MetaRow = {
    id: string;
    title: string | null;
    property_kind?: string | null;
    source_url: string | null;
    city: string | null;
    thumbnail_url: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    sqm: number | null;
    scraped_at: string | null;
    listing_investment:
      | { rent_est: number | null; rent_confidence: string | null }
      | { rent_est: number | null; rent_confidence: string | null }[]
      | null;
  };

  let meta: MetaRow[] = [];
  if (ids.length > 0) {
    meta = await fetchListingRowsInChunks<MetaRow>(
      supabase,
      "listings",
      "id, title, property_kind, source_url, city, thumbnail_url, bedrooms, bathrooms, sqm, scraped_at, listing_investment(rent_est, rent_confidence)",
      ids
    );
  }
  const metaMap = new Map(meta.map((m) => [m.id, m]));

  rows = rows.filter((row) =>
    listingWithinFreshWindow(metaMap.get(row.id)?.scraped_at ?? null, maxAgeDays)
  );

  const features = rows.map((row) => {
    const m = metaMap.get(row.id);
    const inv = m?.listing_investment;
    const invRow = Array.isArray(inv) ? inv[0] : inv;
    const rentRaw = invRow?.rent_est != null ? Number(invRow.rent_est) : null;
    const rent = resolveRentEstMonthly(row.price, rentRaw);
    const roi = resolveListingGrossRoiPct(row.price, rent, row.roi_gross);
    return {
      id: row.id,
      lng: row.lng,
      lat: row.lat,
      roi,
      price: row.price,
      geocodeQuality: row.geocode_quality,
      rentConfidence: row.rent_confidence ?? invRow?.rent_confidence ?? null,
      source: row.source_portal,
      postalCode: row.postal_code,
      title: cleanListingTitle(m?.title ?? null, m?.property_kind ?? null),
      sourceUrl: m?.source_url ?? null,
      city: m?.city ?? null,
      thumbnailUrl: m?.thumbnail_url ?? null,
      bedrooms: m?.bedrooms ?? null,
      bathrooms: m?.bathrooms ?? null,
      sqm: resolveListingSqm(m?.sqm ?? null, m?.title ?? null),
      rentEst: rent,
      scrapedAt: m?.scraped_at ?? null,
    };
  });

  const byPortal: Record<string, number> = {};
  for (const f of features) {
    const k = f.source ?? "unknown";
    byPortal[k] = (byPortal[k] ?? 0) + 1;
  }

  return NextResponse.json({
    postalCode: cp,
    center: { lat: center.lat, lng: center.lng },
    liveImport: live && waitForScrape,
    refreshStarted,
    scrape: scrapeMeta,
    total: rows.length,
    totalInZone: rows.length,
    maxAgeDays,
    radiusM: usedRadius,
    stockTarget: ZONE_STOCK_TARGET,
    stockSatisfied: merged.size >= ZONE_STOCK_TARGET,
    byPortal,
    features: interleaveByPortal(features, (f) => f.source),
  });
}
