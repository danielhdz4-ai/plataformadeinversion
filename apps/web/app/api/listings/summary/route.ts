import { buildListingSummary } from "@/lib/listing/build-summary";
import { resolveListingGrossRoiPct } from "@/lib/listing/gross-roi";
import { NOTARY_NATIONAL_POSTAL } from "@/lib/notariado/resolve-notary";
import { fetchOfficialMarketForPostals } from "@/lib/listing/official-market-query";
import { fetchItpPctForCcaa } from "@/lib/listing/tax-itp";
import type { RentComparable } from "@/lib/listing/summary-types";
import { getDbClient } from "@/lib/supabase/request-client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(60),
  mode: z.enum(["whole", "rooms"]).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const supabase = await getDbClient();
  const ids = parsed.data.ids;
  const roomMode = parsed.data.mode === "rooms";

  const { data: listings, error } = await supabase
    .from("listings")
    .select(
      `
      id, price, sqm, bedrooms, postal_code, city, ccaa,
      listing_investment ( rent_est, roi_gross, rent_confidence, comparables_count )
    `
    )
    .in("id", ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const postals = [...new Set((listings ?? []).map((l) => l.postal_code).filter(Boolean))] as string[];
  const notaryLookupCodes = [...new Set([...postals, NOTARY_NATIONAL_POSTAL])];
  const notaryByPostal = new Map<string, Record<string, unknown>>();

  if (notaryLookupCodes.length > 0) {
    const { data: notaryRows } = await supabase
      .from("notary_stats")
      .select("*")
      .in("postal_code", notaryLookupCodes);
    for (const n of notaryRows ?? []) {
      const pc = n.postal_code as string;
      if (!notaryByPostal.has(pc)) notaryByPostal.set(pc, n);
    }
  }

  const nationalNotary = notaryByPostal.get(NOTARY_NATIONAL_POSTAL) ?? null;
  function notaryForListing(postal: string | null | undefined) {
    if (postal && notaryByPostal.has(postal)) return notaryByPostal.get(postal)!;
    return nationalNotary;
  }

  const officialByPostal = await fetchOfficialMarketForPostals(
    supabase,
    (listings ?? []).map((l) => l.postal_code)
  );

  const comparablesById = new Map<string, RentComparable[]>();

  await Promise.all(
    ids.map(async (id) => {
      const { data: comps, error: compErr } = await supabase.rpc("rent_comparables_near", {
        p_listing_id: id,
        max_m: roomMode ? 2500 : 500,
        lim: roomMode ? 24 : 8,
      });
      if (compErr || !comps) {
        comparablesById.set(id, []);
        return;
      }
      comparablesById.set(
        id,
        (comps as Record<string, unknown>[]).map((c) => ({
          id: c.id as string,
          title: (c.title as string) ?? null,
          price: Number(c.price),
          sqm: c.sqm != null ? Number(c.sqm) : null,
          bedrooms: c.bedrooms != null ? Number(c.bedrooms) : null,
          distanceM: Number(c.distance_m),
        }))
      );
    })
  );

  const summaries: Record<string, ReturnType<typeof buildListingSummary>> = {};
  const { isRoomRentComparable, estimateRoomRentMonthly } = await import(
    "@/lib/listing/room-rent"
  );

  for (const row of listings ?? []) {
    const inv = Array.isArray(row.listing_investment)
      ? row.listing_investment[0]
      : row.listing_investment;
    const itpPct = await fetchItpPctForCcaa(supabase, row.ccaa as string | null);
    const allComps = comparablesById.get(row.id) ?? [];
    const summary = buildListingSummary(
      {
        id: row.id,
        price: Number(row.price),
        sqm: row.sqm != null ? Number(row.sqm) : null,
        postal_code: row.postal_code,
        ccaa: row.ccaa as string | null,
        listing_investment: inv
          ? {
              rent_est: inv.rent_est != null ? Number(inv.rent_est) : null,
              roi_gross: inv.roi_gross != null ? Number(inv.roi_gross) : null,
              rent_confidence: inv.rent_confidence as string | null,
              comparables_count: Number(inv.comparables_count ?? 0),
            }
          : null,
      },
      roomMode ? allComps.filter((c) => !isRoomRentComparable(c)).slice(0, 5) : allComps.slice(0, 5),
      notaryForListing(row.postal_code as string | null),
      row.postal_code ? officialByPostal.get(row.postal_code) ?? [] : [],
      itpPct
    );

    if (roomMode) {
      const roomComps = allComps.filter(isRoomRentComparable).slice(0, 16);
      const compIds = roomComps.map((c) => c.id);
      const meta = new Map<string, { thumbnail_url?: string; source_url?: string }>();
      if (compIds.length > 0) {
        const { data: metaRows } = await supabase
          .from("listings")
          .select("id, thumbnail_url, source_url")
          .in("id", compIds);
        for (const m of metaRows ?? []) {
          meta.set(m.id as string, m as { thumbnail_url?: string; source_url?: string });
        }
      }
      const beds = row.bedrooms != null ? Number(row.bedrooms) : 2;
      const est = estimateRoomRentMonthly(roomComps, beds);
      summary.roomRent = {
        comparables: roomComps.map((c) => ({
          ...c,
          thumbnailUrl: meta.get(c.id)?.thumbnail_url ?? null,
          sourceUrl: meta.get(c.id)?.source_url ?? null,
        })),
        estimatePerRoom: est.perRoom,
        conservativePerRoom: est.conservativePerRoom,
        totalEstimateMonthly: est.total,
        bedrooms: beds,
      };
      if (est.total != null && est.total > 0) {
        const price = Number(row.price);
        summary.roi.rentEstMonthly = est.total;
        summary.roi.grossRoiPct = resolveListingGrossRoiPct(price, est.total, null);
        summary.roi.comparablesCount = roomComps.length;
        summary.roi.rentConfidence =
          roomComps.length >= 8 ? "alta" : roomComps.length >= 3 ? "media" : "baja";
      }
    }

    summaries[row.id] = summary;
  }

  return NextResponse.json({ summaries });
}
