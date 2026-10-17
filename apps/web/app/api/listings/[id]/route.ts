import { fetchOfficialMarketForPostal } from "@/lib/listing/official-market-query";
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
  let notary = null;
  let official = null;
  if (postal) {
    const { data: n } = await supabase
      .from("notary_stats")
      .select("*")
      .eq("postal_code", postal)
      .order("period", { ascending: false })
      .limit(1)
      .maybeSingle();
    notary = n;
  }
  official = postal ? await fetchOfficialMarketForPostal(supabase, postal) : [];

  return NextResponse.json({
    ...data,
    investment: inv,
    enrichment: enrich,
    notary,
    officialMarket: official,
  });
}
