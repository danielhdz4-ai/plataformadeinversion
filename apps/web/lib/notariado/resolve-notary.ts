import type { SupabaseClient } from "@supabase/supabase-js";

export const NOTARY_NATIONAL_POSTAL = "ES000";

/** CP del anuncio, o referencia nacional España (penotariado.com). */
export async function fetchNotaryForListing(
  supabase: SupabaseClient,
  postalCode: string | null | undefined
) {
  const codes = new Set<string>([NOTARY_NATIONAL_POSTAL]);
  if (postalCode?.trim()) codes.add(postalCode.trim());

  const { data } = await supabase.from("notary_stats").select("*").in("postal_code", [...codes]);

  if (postalCode?.trim()) {
    const exact = (data ?? []).find((n) => n.postal_code === postalCode.trim());
    if (exact) return { row: exact, scope: "postal" as const };
  }
  const national = (data ?? []).find((n) => n.postal_code === NOTARY_NATIONAL_POSTAL);
  if (national) return { row: national, scope: "national" as const };
  return { row: null, scope: null };
}
