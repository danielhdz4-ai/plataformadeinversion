/** Mensaje al usuario: genérico, sin nombres de tablas, SQL ni hosts. */
export const USER_DB_ERROR = "No se pudieron cargar los datos. Vuelve a intentarlo en unos segundos.";

/** Mensaje al usuario para la base de datos inaccesible (mantenimiento/reintento). */
export const USER_DB_MAINTENANCE =
  "Estamos actualizando los datos. Vuelve a intentarlo en un par de minutos.";

/**
 * Registra el error técnico en servidor y devuelve una copia pública.
 * El detalle solo se expone si `exposeDetail` (herramientas internas/ops).
 */
export function publicDbError(
  scope: string,
  raw: string,
  options?: { exposeDetail?: boolean; userMessage?: string }
): string {
  console.error(`[${scope}]`, raw);
  if (options?.exposeDetail) return raw;
  return options?.userMessage ?? USER_DB_ERROR;
}

export function dbErrorFromUnknown(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return "database_error";
}

export function isLikelyUnreachable(message: string): boolean {
  return /fetch failed|ENOTFOUND|getaddrinfo|EAI_AGAIN|Connect Timeout/i.test(message);
}

type SupabaseProbe = { host?: string | null; reachable?: boolean; error?: string | null };

export function unreachableSupabasePayload(probe: SupabaseProbe) {
  const host = probe.host ?? "desconocido";
  console.error(`[supabase-unreachable] host=${host} error=${probe.error ?? "unknown"}`);

  return {
    error: USER_DB_MAINTENANCE,
    code: "SUPABASE_UNREACHABLE" as const,
    supabaseHost: host,
  };
}

/**
 * Probe rápido antes de rutas pesadas: si la base no responde devolvemos
 * 503 con mensaje de mantenimiento en lugar de un error técnico.
 */
export async function ensureSupabaseReachable(): Promise<
  | { ok: true }
  | { ok: false; status: number; body: ReturnType<typeof unreachableSupabasePayload> }
> {
  const { probeSupabase } = await import("@/lib/ops/verify-supabase");
  const probe = await probeSupabase();
  if (probe.reachable) return { ok: true };
  return { ok: false, status: 503, body: unreachableSupabasePayload(probe) };
}

