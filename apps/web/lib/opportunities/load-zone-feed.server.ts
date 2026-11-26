import { cleanListingTitle } from "@/lib/listing/display-title";
import { cpRadiusSteps, ZONE_STOCK_TARGET } from "@/lib/map/cp-zone-stock";
import { grossRoiForDisplay } from "@/lib/listing/display-roi";
import { buildSummariesBatch } from "@/lib/listing/build-summaries-batch";
import { resolveListingGrossRoiPct } from "@/lib/listing/gross-roi";
import {
  listingWithinFreshWindow,
  qualifiesAsOpportunity,
  quickOpportunityCandidate,
} from "@/lib/listing/opportunity-qualify";
import { resolveRentEstMonthly } from "@/lib/listing/rent-est";
import { isResidentialPropertyKind } from "@/lib/listing/residential-kind";
import { resolveListingSqm } from "@/lib/listing/resolve-sqm";
import { fetchListingRowsInChunks } from "@/lib/supabase/fetch-in-chunks";

type ZoneListingRow = {
  id: string;
  title: string | null;
  price: number;
  sqm: number | null;
  city: string | null;
  postal_code: string | null;
  ccaa: string | null;
  source_portal: string | null;
  source_url: string | null;
  thumbnail_url: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  scraped_at: string | null;
  property_kind: string | null;
  is_opportunity: boolean | null;
  listing_investment: unknown;
};

const LISTING_SELECT = `
  id, title, price, sqm, city, postal_code, ccaa, source_portal, source_url,
  thumbnail_url, bedrooms, bathrooms, scraped_at, property_kind,
  is_opportunity, opportunity_score, opportunity_discount_pct, opportunity_valuation_mid,
  opportunity_computed_at,
  listing_investment ( rent_est, roi_gross, rent_confidence, comparables_count )
`;

type RpcRow = {
  id: string;
  price: number;
  roi_gross: number | null;
  lng: number;
  lat: number;
  postal_code: string | null;
};

const MAP_PORTALS = [
  "fotocasa",
  "pisos_com",
  "kelify",
  "habitaclia",
  "hipoges",
  "solvia",
  "idealista",
] as const;

function bboxFromCenter(lat: number, lng: number, radiusM: number) {
  const dLat = radiusM / 111_000;
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLng = radiusM / (111_000 * Math.max(0.35, cos));
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
}

export async function listingIdsInZone(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/request-client").getDbClient>>,
  lat: number,
  lng: number,
  cp: string,
  radiusM: number,
  maxRows: number
) {
  await supabase.rpc("tag_listings_postal_code", {
    p_cp: cp,
    p_lng: lng,
    p_lat: lat,
    p_radius_m: radiusM,
  });

  const merged = new Map<string, RpcRow>();
  const { data, error } = await supabase.rpc("listings_for_postal_code", {
    p_cp: cp,
    p_lng: lng,
    p_lat: lat,
    p_radius_m: radiusM,
    max_rows: maxRows,
    portal_filter: null,
  });
  if (error) throw error;
  for (const row of (data ?? []) as RpcRow[]) {
    merged.set(row.id, row);
  }

  const exactRows = [...merged.values()].filter((r) => r.postal_code === cp);
  /** El RPC limita filas: si apenas hay anuncios del CP exacto, complementamos por bbox. */
  if (exactRows.length < Math.min(40, Math.max(8, Math.floor(maxRows * 0.1)))) {
    const bbox = bboxFromCenter(lat, lng, radiusM);
    const cap = Math.max(60, Math.ceil(maxRows / MAP_PORTALS.length));
    const batches = await Promise.all(
      MAP_PORTALS.map((portal) =>
        supabase.rpc("map_listings_in_bbox", {
          min_lng: bbox.minLng,
          min_lat: bbox.minLat,
          max_lng: bbox.maxLng,
          max_lat: bbox.maxLat,
          max_rows: cap,
          portal_filter: portal,
        })
      )
    );
    for (const { data: rows, error: boxErr } of batches) {
      if (boxErr) continue;
      for (const row of (rows ?? []) as {
        id: string;
        price: number;
        roi_gross: number | null;
        lng: number;
        lat: number;
        postal_code?: string | null;
      }[]) {
        if (merged.has(row.id)) continue;
        merged.set(row.id, {
          id: row.id,
          price: row.price,
          roi_gross: row.roi_gross,
          lng: row.lng,
          lat: row.lat,
          postal_code: row.postal_code ?? null,
        });
        if (merged.size >= maxRows) break;
      }
      if (merged.size >= maxRows) break;
    }
  }

  return [...merged.values()];
}

function invRow(raw: unknown) {
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

export async function loadZoneOpportunityFeed(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/request-client").getDbClient>>,
  opts: {
    lat: number;
    lng: number;
    cp: string;
    radiusM: number;
    limit: number;
    offset?: number;
    maxAgeDays?: number;
    chollosOnly?: boolean;
  }
) {
  const maxAgeDays = opts.maxAgeDays ?? 14;
  const offset = Math.max(0, opts.offset ?? 0);
  /**
   * Zona por barrio/municipio (sin CP): radios amplios.
   * CP concreto: primero el radio ajustado al bbox del CP (área ≈ código postal)
   * y luego se amplía si el stock no llega al objetivo.
   */
  const radiusSteps = opts.cp
    ? cpRadiusSteps(opts.radiusM)
    : cpRadiusSteps(Math.max(opts.radiusM, 9000)).concat(20_000);

  const maxRows = Math.min(800, Math.max(opts.limit, 200));
  let radiusM = radiusSteps[0] ?? opts.radiusM;
  let rpcRows: Awaited<ReturnType<typeof listingIdsInZone>> = [];
  for (const r of radiusSteps) {
    radiusM = r;
    rpcRows = await listingIdsInZone(supabase, opts.lat, opts.lng, opts.cp, radiusM, maxRows);
    if (rpcRows.length >= ZONE_STOCK_TARGET) break;
    if (offset > 0 && rpcRows.length > offset) break;
  }
  /**
   * Fallback ciudad (Madrid): un CP urbano cubre una fracción del municipio y el
   * portal solo publica una parte; si el CP no llega al objetivo, ampliamos al
   * municipio para que el mapa no aparezca vacío.
   */
  const cityRadiusM = Number(process.env.ZONE_CITY_FALLBACK_M ?? "18000");
  if (rpcRows.length < ZONE_STOCK_TARGET && radiusM < cityRadiusM) {
    radiusM = cityRadiusM;
    rpcRows = await listingIdsInZone(supabase, opts.lat, opts.lng, opts.cp, radiusM, maxRows);
  }
  const pinById = new Map(rpcRows.map((r) => [r.id, { lng: r.lng, lat: r.lat }]));
  const ids = rpcRows.map((r) => r.id);
  const exactTagged = rpcRows.filter((r) => r.postal_code === opts.cp).length;
  if (!ids.length) {
    return {
      items: [],
      totalInZone: 0,
      opportunitiesInZone: 0,
      totalActiveInZone: 0,
      hasMore: false,
      nextOffset: 0,
      maxAgeDays,
      radiusM,
      exactTagged: 0,
      cp: opts.cp,
    };
  }

  const rows = await fetchListingRowsInChunks<ZoneListingRow>(
    supabase,
    "listings",
    LISTING_SELECT,
    ids
  );

  const residential = rows.filter((r) => {
    if (!isResidentialPropertyKind(r.property_kind as string | null)) return false;
    return listingWithinFreshWindow(r.scraped_at as string | null, maxAgeDays);
  });

  const forSummary = residential.map((r) => {
    const inv = invRow(r.listing_investment);
    return {
      id: r.id as string,
      price: Number(r.price),
      sqm: resolveListingSqm(r.sqm as number | null, r.title as string | null),
      title: r.title as string | null,
      bedrooms: r.bedrooms as number | null,
      postal_code: r.postal_code as string | null,
      city: r.city as string | null,
      ccaa: r.ccaa as string | null,
      source_portal: r.source_portal as string | null,
      source_url: r.source_url as string | null,
      scraped_at: r.scraped_at as string | null,
      listing_investment: inv
        ? {
            rent_est: inv.rent_est != null ? Number(inv.rent_est) : null,
            roi_gross: inv.roi_gross != null ? Number(inv.roi_gross) : null,
            rent_confidence: inv.rent_confidence as string | null,
            comparables_count: Number(inv.comparables_count ?? 0),
          }
        : null,
    };
  });

  const summaries = await buildSummariesBatch(supabase, forSummary);

  const items = [];
  let opportunitiesInZone = 0;

  for (const row of forSummary) {
    const r = residential.find((x) => x.id === row.id)!;
    const inv = invRow(r.listing_investment);
    const rent = resolveRentEstMonthly(row.price, inv?.rent_est ?? null);
    const summary = summaries[row.id];
    if (!summary) continue;
    const roiRaw = resolveListingGrossRoiPct(row.price, rent, inv?.roi_gross ?? null);
    const roi =
      grossRoiForDisplay(
        roiRaw,
        summary.roi.rentConfidence ?? inv?.rent_confidence ?? null,
        summary.roi.comparablesCount ?? inv?.comparables_count ?? null
      ) ?? roiRaw;
    const opp = summary.opportunity;
    const isOpp =
      Boolean(r.is_opportunity) ||
      (opp && qualifiesAsOpportunity(opp, roiRaw, row.price)) ||
      quickOpportunityCandidate({
        roiGross: roiRaw,
        sourcePortal: row.source_portal,
        price: row.price,
      });

    if (opts.chollosOnly !== false && !isOpp) continue;
    if (isOpp) opportunitiesInZone++;

    const pin = pinById.get(row.id);
    items.push({
      id: row.id,
      title: cleanListingTitle(r.title as string, r.property_kind as string | null),
      postalCode: r.postal_code as string | null,
      price: row.price,
      sqm: row.sqm,
      bedrooms: r.bedrooms as number | null,
      bathrooms: r.bathrooms as number | null,
      sourcePortal: r.source_portal as string | null,
      sourceUrl: r.source_url as string | null,
      thumbnailUrl: r.thumbnail_url as string | null,
      scrapedAt: r.scraped_at as string | null,
      lng: pin?.lng ?? null,
      lat: pin?.lat ?? null,
      roi,
      rentEst: summary?.roi.rentEstMonthly ?? rent,
      rentConfidence: summary?.roi.rentConfidence ?? null,
      isOpportunity: isOpp,
      summary,
    });
  }

  items.sort(
    (a, b) =>
      (b.summary.opportunity.opportunityScore ?? 0) - (a.summary.opportunity.opportunityScore ?? 0)
  );

  const page = items.slice(offset, offset + opts.limit);

  return {
    items: page,
    totalInZone: residential.length,
    totalActiveInZone: residential.length,
    opportunitiesInZone,
    hasMore: offset + opts.limit < items.length,
    nextOffset: offset + page.length,
    maxAgeDays,
    radiusM,
    exactTagged,
    cp: opts.cp,
  };
}
