import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
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

  return NextResponse.json({
    ...data,
    investment: inv,
  });
}
