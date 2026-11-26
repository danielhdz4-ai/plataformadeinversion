/**
 * Auditoría de frescura del inventario por portal.
 *   node --env-file=.env.local scripts/ops/audit-freshness.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

const days = Number(process.env.FRESH_DAYS ?? "7");
const since = new Date(Date.now() - days * 86_400_000).toISOString();

const portals = ["fotocasa", "pisos_com", "hipoges", "solvia", "kelify"];
for (const portal of portals) {
  const { count: total } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("operation", "sale")
    .eq("status", "active")
    .eq("source_portal", portal);

  const { count: fresh } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("operation", "sale")
    .eq("status", "active")
    .eq("source_portal", portal)
    .gte("last_seen_at", since);

  const { data: last } = await supabase
    .from("listings")
    .select("last_seen_at")
    .eq("operation", "sale")
    .eq("source_portal", portal)
    .order("last_seen_at", { ascending: false })
    .limit(1);

  const pct = total ? Math.round(((fresh ?? 0) / total) * 100) : 0;
  console.log(
    `${portal.padEnd(9)} total=${String(total ?? 0).padStart(6)}  frescos(<${days}d)=${String(fresh ?? 0).padStart(6)}  ${pct}%  último=${last?.[0]?.last_seen_at?.slice(0, 16) ?? "-"}`
  );
}
