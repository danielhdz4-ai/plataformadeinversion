import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: scan } = await supabase.from("scans").select("user_id").eq("id", id).single();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !scan || scan.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("scan_results")
    .select(
      `
      rank,
      roi_gross,
      listing:listings (
        id, title, price, source_url, city,
        listing_investment ( rent_est, rent_confidence )
      )
    `
    )
    .eq("scan_id", id)
    .order("rank");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = (data ?? []).map((row) => ({
    rank: row.rank,
    roi_gross: row.roi_gross,
    listing: Array.isArray(row.listing) ? row.listing[0] : row.listing,
  }));

  return NextResponse.json({ results });
}
