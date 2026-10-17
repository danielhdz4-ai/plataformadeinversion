import { buildListingSummary } from "@/lib/listing/build-summary";
import { fetchOfficialMarketForPostals } from "@/lib/listing/official-market-query";
import { fetchItpPctForCcaa } from "@/lib/listing/tax-itp";
import type { RentComparable } from "@/lib/listing/summary-types";
import { getDbClient } from "@/lib/supabase/request-client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(60),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const supabase = await getDbClient();
  const ids = parsed.data.ids;

  const { data: listings, error } = await supabase
    .from("listings")
    .select(
      `
      id, price, sqm, postal_code, city, ccaa,
      listing_investment ( rent_est, roi_gross, rent_confidence, comparables_count )
    `
    )
    .in("id", ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const postals = [...new Set((listings ?? []).map((l) => l.postal_code).filter(Boolean))] as string[];
  const notaryByPostal = new Map<string, Record<string, unknown>>();

  if (postals.length > 0) {
    const { data: notaryRows } = await supabase
      .from("notary_stats")
      .select("*")
      .in("postal_code", postals);
    for (const n of notaryRows ?? []) {
      const pc = n.postal_code as string;
      if (!notaryByPostal.has(pc)) notaryByPostal.set(pc, n);
    }
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
        max_m: 500,
        lim: 5,
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

  for (const row of listings ?? []) {
    const inv = Array.isArray(row.listing_investment)
      ? row.listing_investment[0]
      : row.listing_investment;
    const itpPct = await fetchItpPctForCcaa(supabase, row.ccaa as string | null);
    summaries[row.id] = buildListingSummary(
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
      comparablesById.get(row.id) ?? [],
      row.postal_code ? notaryByPostal.get(row.postal_code) ?? null : null,
      row.postal_code ? officialByPostal.get(row.postal_code) ?? [] : [],
      itpPct
    );
  }

  return NextResponse.json({ summaries });
}
