import { buildListingSummary } from "@/lib/listing/build-summary";
import { resolveListingSqm } from "@/lib/listing/resolve-sqm";
import { notaryRowForListingValuation } from "@/lib/listing/notary-valuation-scope";
import { fetchOfficialMarketForPostals } from "@/lib/listing/official-market-query";
import { fetchItpPctForCcaa } from "@/lib/listing/tax-itp";
import type { ListingSummary } from "@/lib/listing/summary-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ListingRowForSummary = {
  id: string;
  price: number;
  sqm: number | null;
  title: string | null;
  bedrooms: number | null;
  postal_code: string | null;
  city: string | null;
  ccaa: string | null;
  source_portal?: string | null;
  source_url?: string | null;
  scraped_at?: string | null;
  listing_investment?: {
    rent_est: number | null;
    roi_gross: number | null;
    rent_confidence: string | null;
    comparables_count: number;
  } | null;
};

export async function buildSummariesBatch(
  supabase: SupabaseClient,
  rows: ListingRowForSummary[]
): Promise<Record<string, ListingSummary>> {
  const postals = [...new Set(rows.map((l) => l.postal_code).filter(Boolean))] as string[];
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

  function notaryForListing(postal: string | null | undefined) {
    return notaryRowForListingValuation(postal, notaryByPostal);
  }

  const officialByPostal = await fetchOfficialMarketForPostals(
    supabase,
    rows.map((l) => l.postal_code)
  );

  const summaries: Record<string, ListingSummary> = {};
  const ccaaItp = new Map<string, number>();

  for (const row of rows) {
    const inv = row.listing_investment;
    const ccaa = row.ccaa;
    let itpPct = ccaaItp.get(ccaa ?? "");
    if (itpPct == null) {
      itpPct = await fetchItpPctForCcaa(supabase, ccaa);
      if (ccaa) ccaaItp.set(ccaa, itpPct);
    }

    summaries[row.id] = buildListingSummary(
      {
        id: row.id,
        price: Number(row.price),
        sqm: resolveListingSqm(row.sqm, row.title),
        postal_code: row.postal_code,
        ccaa: row.ccaa,
        source_portal: row.source_portal,
        title: row.title,
        source_url: row.source_url,
        scraped_at: row.scraped_at,
        listing_investment: inv
          ? {
              rent_est: inv.rent_est,
              roi_gross: inv.roi_gross,
              rent_confidence: inv.rent_confidence,
              comparables_count: inv.comparables_count ?? 0,
            }
          : null,
      },
      [],
      notaryForListing(row.postal_code),
      row.postal_code ? officialByPostal.get(row.postal_code) ?? [] : [],
      itpPct,
      null
    );
  }

  return summaries;
}
