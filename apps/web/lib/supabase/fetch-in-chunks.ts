import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_CHUNK = 200;

/** PostgREST `.in()` con cientos de UUIDs suele fallar; pedimos en tandas. */
export async function fetchListingRowsInChunks<T extends { id: string }>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  ids: string[],
  chunkSize = DEFAULT_CHUNK
): Promise<T[]> {
  if (ids.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase.from(table).select(columns).in("id", slice);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as unknown as T[];
    if (chunk.length) out.push(...chunk);
  }
  return out;
}
