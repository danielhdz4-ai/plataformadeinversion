import { cleanListingTitle } from "@/lib/listing/display-title";
import { grossRoiForDisplay } from "@/lib/listing/display-roi";
import { buildSummariesBatch } from "@/lib/listing/build-summaries-batch";
import type { ListingSummary } from "@/lib/listing/summary-types";
import {
  listingWithinFreshWindow,
  OPPORTUNITY_FEED_DEFAULTS,
  qualifiesAsOpportunity,
  quickOpportunityCandidate,
} from "@/lib/listing/opportunity-qualify";
import { resolveListingGrossRoiPct } from "@/lib/listing/gross-roi";
import { resolveRentEstMonthly } from "@/lib/listing/rent-est";
import { isResidentialPropertyKind } from "@/lib/listing/residential-kind";
import { resolveListingSqm } from "@/lib/listing/resolve-sqm";
import {
  dbErrorFromUnknown,
  ensureSupabaseReachable,
  isLikelyUnreachable,
  publicDbError,
  unreachableSupabasePayload,
} from "@/lib/ops/db-api-errors";
import { probeSupabase } from "@/lib/ops/verify-supabase";
import { getDbClient, requireAppUser } from "@/lib/supabase/request-client";
import { NextRequest, NextResponse } from "next/server";

const RETURN_LIMIT = 200;
const LEGACY_CANDIDATE_LIMIT = 350;

const LISTING_SELECT = `
  id, title, price, sqm, city, postal_code, ccaa, source_portal, source_url,
  thumbnail_url, bedrooms, bathrooms, scraped_at, property_kind,
  is_opportunity, opportunity_score, opportunity_discount_pct, opportunity_valuation_mid,
  opportunity_computed_at,
  listing_investment ( rent_est, roi_gross, rent_confidence, comparables_count )
`;

type Inv = {
  rent_est: number | null;
  roi_gross: number | null;
  rent_confidence: string | null;
  comparables_count: number;
};

function invRow(raw: unknown): Inv | null {
  if (Array.isArray(raw)) return (raw[0] as Inv) ?? null;
  return (raw as Inv) ?? null;
}

function rowToItem(r: Record<string, unknown>, summary: ListingSummary) {
  return {
    id: r.id as string,
    title: cleanListingTitle(r.title as string, r.property_kind as string | null),
    city: r.city as string | null,
    postalCode: r.postal_code as string | null,
    price: Number(r.price),
    sqm: resolveListingSqm(r.sqm as number | null, r.title as string | null),
    bedrooms: r.bedrooms as number | null,
    bathrooms: r.bathrooms as number | null,
    sourcePortal: r.source_portal as string | null,
    sourceUrl: r.source_url as string | null,
    thumbnailUrl: r.thumbnail_url as string | null,
    scrapedAt: r.scraped_at as string | null,
    lng: null as number | null,
    lat: null as number | null,
    roi:
      grossRoiForDisplay(
        summary.roi.grossRoiPct,
        summary.roi.rentConfidence,
        summary.roi.comparablesCount
      ) ?? summary.roi.grossRoiPct,
    rentEst: summary.roi.rentEstMonthly,
    rentConfidence: summary.roi.rentConfidence,
    isOpportunity: true as const,
    opportunity: summary.opportunity,
    summary,
    computedAt: (r.opportunity_computed_at as string | null) ?? null,
  };
}

async function attachPins(
  supabase: Awaited<ReturnType<typeof getDbClient>>,
  items: { id: string; lng: number | null; lat: number | null }[]
) {
  const pinIds = items.map((x) => x.id);
  if (!pinIds.length) return;
  const { data: pinRows } = await supabase.rpc("listings_pins_by_ids", { ids: pinIds });
  const pinById = new Map<string, { lng: number; lat: number }>();
  for (const p of pinRows ?? []) {
    const row = p as { id: string; lng: number; lat: number };
    if (row.lng != null && row.lat != null) pinById.set(row.id, { lng: row.lng, lat: row.lat });
  }
  for (const it of items) {
    const pin = pinById.get(it.id);
    it.lng = pin?.lng ?? null;
    it.lat = pin?.lat ?? null;
  }
}

function rowForSummary(r: Record<string, unknown>) {
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
          rent_confidence: inv.rent_confidence,
          comparables_count: Number(inv.comparables_count ?? 0),
        }
      : null,
  };
}

async function loadFromStoredFlags(
  supabase: Awaited<ReturnType<typeof getDbClient>>,
  cp: string | undefined,
  max: number
) {
  const freshSince = new Date(
    Date.now() - OPPORTUNITY_FEED_DEFAULTS.maxScrapedAgeDays * 86400000
  ).toISOString();

  let q = supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("status", "active")
    .eq("operation", "sale")
    .eq("is_opportunity", true)
    .gte("scraped_at", freshSince)
    .order("scraped_at", { ascending: false })
    .limit(Math.min(500, max * 3));

  if (cp?.length === 5) q = q.eq("postal_code", cp);

  const { data: rows, error } = await q;
  if (error) throw error;

  const residential = (rows ?? []).filter(
    (r) =>
      isResidentialPropertyKind(r.property_kind as string | null) &&
      listingWithinFreshWindow(r.scraped_at as string | null)
  );

  if (!residential.length) {
    return { items: [], totalQualified: 0, scanned: 0, source: "stored" as const };
  }

  const forSummary = residential.map((r) => rowForSummary(r as Record<string, unknown>));
  const summaries = await buildSummariesBatch(supabase, forSummary);

  const items = [];
  for (const row of forSummary) {
    const summary = summaries[row.id];
    if (!summary) continue;
    const roi = summary.roi.grossRoiPct;
    if (!qualifiesAsOpportunity(summary.opportunity, roi, row.price)) continue;
    const r = residential.find((x) => x.id === row.id)!;
    items.push(rowToItem(r as Record<string, unknown>, summary));
  }

  items.sort((a, b) => {
    const ta = Date.parse(a.scrapedAt ?? "") || 0;
    const tb = Date.parse(b.scrapedAt ?? "") || 0;
    if (tb !== ta) return tb - ta;
    return (b.summary.opportunity.opportunityScore ?? 0) - (a.summary.opportunity.opportunityScore ?? 0);
  });

  const slice = items.slice(0, max);
  await attachPins(supabase, slice);

  return {
    items: slice,
    totalQualified: Math.max(items.length, residential.length),
    scanned: residential.length,
    source: "stored" as const,
  };
}

/** Fallback si la migración/job aún no corrieron en prod. */
async function loadLegacyCompute(
  supabase: Awaited<ReturnType<typeof getDbClient>>,
  cp: string | undefined,
  max: number
) {
  const freshSince = new Date(
    Date.now() - OPPORTUNITY_FEED_DEFAULTS.maxScrapedAgeDays * 86400000
  ).toISOString();

  let q = supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("status", "active")
    .gte("scraped_at", freshSince)
    .order("scraped_at", { ascending: false })
    .limit(LEGACY_CANDIDATE_LIMIT);

  if (cp?.length === 5) q = q.eq("postal_code", cp);

  const { data: rows, error } = await q;
  if (error) throw error;

  const residential = (rows ?? []).filter((r) =>
    isResidentialPropertyKind(r.property_kind as string | null)
  );

  const candidates = residential.filter((r) => {
    const inv = invRow(r.listing_investment);
    const rent = resolveRentEstMonthly(Number(r.price), inv?.rent_est ?? null);
    const roi = resolveListingGrossRoiPct(Number(r.price), rent, inv?.roi_gross ?? null);
    return quickOpportunityCandidate({
      roiGross: roi,
      sourcePortal: r.source_portal as string,
      price: Number(r.price),
    });
  });

  const pool = candidates.length >= 12 ? candidates : residential.slice(0, 120);

  const forSummary = pool.map((r) => {
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
            rent_confidence: inv.rent_confidence,
            comparables_count: Number(inv.comparables_count ?? 0),
          }
        : null,
    };
  });

  const summaries = await buildSummariesBatch(supabase, forSummary);
  const items = [];
  for (const row of forSummary) {
    const summary = summaries[row.id];
    const opp = summary?.opportunity;
    const roi = summary?.roi.grossRoiPct ?? null;
    if (!opp || !qualifiesAsOpportunity(opp, roi, row.price)) continue;
    const r = pool.find((x) => x.id === row.id)!;
    items.push(rowToItem(r as Record<string, unknown>, summary));
  }

  items.sort((a, b) => (b.opportunity.opportunityScore ?? 0) - (a.opportunity.opportunityScore ?? 0));
  const slice = items.slice(0, max);
  await attachPins(supabase, slice);

  return {
    items: slice,
    totalQualified: Math.max(items.length, pool.length),
    scanned: pool.length,
    source: "computed" as const,
  };
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

  const supabase = await getDbClient();
  const p = req.nextUrl.searchParams;
  const cp = p.get("cp")?.replace(/\D/g, "").slice(0, 5);
  const max = Math.min(Number(p.get("limit") ?? RETURN_LIMIT), 500);
  const forceCompute = p.get("legacy") === "1";

  try {
    if (!forceCompute) {
      const stored = await loadFromStoredFlags(supabase, cp, max);
      if (stored.items.length > 0) {
        return NextResponse.json({ ...stored, cp: cp ?? null });
      }
    }

    const legacy = await loadLegacyCompute(supabase, cp, max);
    return NextResponse.json({ ...legacy, cp: cp ?? null });
  } catch (e) {
    const message = dbErrorFromUnknown(e);
    if (message.includes("is_opportunity") || message.includes("opportunity_score")) {
      const legacy = await loadLegacyCompute(supabase, cp, max);
      return NextResponse.json({ ...legacy, cp: cp ?? null, source: "computed" });
    }
    if (isLikelyUnreachable(message)) {
      const probe = await probeSupabase();
      return NextResponse.json(unreachableSupabasePayload(probe), { status: 503 });
    }
    return NextResponse.json({ error: publicDbError("api/opportunities", message), code: "DB" }, { status: 500 });
  }
}
