import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_ITP_PCT = 10;
const cache = new Map<string, number>();

export async function fetchItpPctForCcaa(
  supabase: SupabaseClient,
  ccaa: string | null | undefined
): Promise<number> {
  if (!ccaa?.trim()) return DEFAULT_ITP_PCT;
  const key = ccaa.trim();
  const hit = cache.get(key);
  if (hit != null) return hit;
  const { data } = await supabase.from("tax_rules").select("itp_pct").eq("ccaa", key).maybeSingle();
  const pct = data?.itp_pct != null ? Number(data.itp_pct) : DEFAULT_ITP_PCT;
  cache.set(key, pct);
  return pct;
}

export { DEFAULT_ITP_PCT };
