/**
 * Purga listings archived >90 días (hard delete enrichment/investment via cascade).
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);
const days = Number(process.env.PURGE_ARCHIVED_DAYS ?? "90");
const cutoff = new Date(Date.now() - days * 86400_000).toISOString();

const { data: rows, error } = await supabase
  .from("listings")
  .select("id")
  .eq("status", "archived")
  .lt("scraped_at", cutoff)
  .limit(500);

if (error) {
  console.error(error.message);
  process.exit(1);
}

const ids = (rows ?? []).map((r) => r.id);
if (ids.length === 0) {
  console.log(JSON.stringify({ ok: true, deleted: 0 }));
  process.exit(0);
}

const { error: delErr } = await supabase.from("listings").delete().in("id", ids);
if (delErr) {
  console.error(delErr.message);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, deleted: ids.length, cutoff }));
