import { resolveListingGrossRoiPct } from "@/lib/listing/gross-roi";
import { resolveRentEstMonthly } from "@/lib/listing/rent-est";
import { fetchOfficialMarketForPostal } from "@/lib/listing/official-market-query";
import { fetchNotaryForListing } from "@/lib/notariado/resolve-notary";
import { getDbClient } from "@/lib/supabase/request-client";
import { NextResponse } from "next/server";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await getDbClient();
  const { data, error } = await supabase
    .from("listings")
    .select(
      `
      *,
      listing_investment ( rent_est, roi_gross, rent_confidence, comparables_count ),
      listing_enrichment ( rc, catastral_surface, year_built )
    `
    )
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const inv = Array.isArray(data.listing_investment)
    ? data.listing_investment[0]
    : data.listing_investment;
  const enrich = Array.isArray(data.listing_enrichment)
    ? data.listing_enrichment[0]
    : data.listing_enrichment;

  const postal = (data as { postal_code?: string }).postal_code;
  const { row: notary } = await fetchNotaryForListing(supabase, postal ?? null);
  let official = null;
  official = postal ? await fetchOfficialMarketForPostal(supabase, postal) : [];

  const price = Number((data as { price?: number }).price);
  const rentResolved = resolveRentEstMonthly(price, inv?.rent_est ?? null);
  const investment = inv
    ? {
        ...inv,
        rent_est: rentResolved,
        roi_gross: resolveListingGrossRoiPct(
          price,
          rentResolved,
          inv.roi_gross != null ? Number(inv.roi_gross) : null
        ),
      }
    : null;

  return NextResponse.json({
    ...data,
    investment,
    enrichment: enrich,
    notary,
    officialMarket: official,
  });
}
