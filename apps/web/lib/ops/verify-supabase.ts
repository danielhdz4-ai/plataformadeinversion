import { createAdminClient } from "@/lib/supabase/admin";

export type SupabaseProbe = {
  configured: boolean;
  host: string | null;
  reachable: boolean;
  listingsOk: boolean;
  listingsCount: number | null;
  error: string | null;
};

export function supabaseHostFromEnv(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

/** Ping ligero a Supabase (mantiene proyecto activo + valida conectividad). */
export async function probeSupabase(): Promise<SupabaseProbe> {
  const host = supabaseHostFromEnv();
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!configured) {
    return {
      configured: false,
      host,
      reachable: false,
      listingsOk: false,
      listingsCount: null,
      error: "missing_supabase_env",
    };
  }

  try {
    const admin = createAdminClient();
    const { count, error } = await admin.from("listings").select("id", { count: "exact", head: true });
    if (error) {
      const schemaMissing =
        error.code === "PGRST205" ||
        /Could not find the table|schema cache/i.test(error.message ?? "");
      return {
        configured: true,
        host,
        reachable: schemaMissing,
        listingsOk: false,
        listingsCount: null,
        error: schemaMissing ? "schema_missing_listings" : error.message,
      };
    }
    return {
      configured: true,
      host,
      reachable: true,
      listingsOk: true,
      listingsCount: count ?? 0,
      error: null,
    };
  } catch (e) {
    return {
      configured: true,
      host,
      reachable: false,
      listingsOk: false,
      listingsCount: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}