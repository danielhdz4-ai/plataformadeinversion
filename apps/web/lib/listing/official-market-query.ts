import { provinceCodeFromPostal } from "@/lib/spain/province-from-postal";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchOfficialMarketForPostals(
  supabase: SupabaseClient,
  postals: (string | null | undefined)[]
): Promise<Map<string, { source: string; period: string; metrics: Record<string, unknown> }[]>> {
  const byProvince = new Map<string, string[]>();
  for (const pc of postals) {
    if (!pc) continue;
    const prov = provinceCodeFromPostal(pc);
    if (!prov) continue;
    const list = byProvince.get(prov) ?? [];
    list.push(pc);
    byProvince.set(prov, list);
  }

  const officialByProvince = new Map<
    string,
    { source: string; period: string; metrics: Record<string, unknown> }[]
  >();

  await Promise.all(
    [...byProvince.keys()].map(async (prov) => {
      const { data } = await supabase
        .from("official_market_stats")
        .select("source, period, metrics")
        .eq("geo_level", "province")
        .eq("geo_code", prov)
        .order("scraped_at", { ascending: false })
        .limit(3);
      officialByProvince.set(
        prov,
        (data ?? []).map((o) => ({
          source: o.source as string,
          period: o.period as string,
          metrics: (o.metrics as Record<string, unknown>) ?? {},
        }))
      );
    })
  );

  const byPostal = new Map<
    string,
    { source: string; period: string; metrics: Record<string, unknown> }[]
  >();
  for (const [prov, pcs] of byProvince) {
    const stats = officialByProvince.get(prov) ?? [];
    for (const pc of pcs) byPostal.set(pc, stats);
  }
  return byPostal;
}

export async function fetchOfficialMarketForPostal(
  supabase: SupabaseClient,
  postal: string | null | undefined
) {
  const map = await fetchOfficialMarketForPostals(supabase, postal ? [postal] : []);
  if (!postal) return [];
  return map.get(postal) ?? [];
}
