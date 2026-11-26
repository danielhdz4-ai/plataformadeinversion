/** Resumen rápido de oportunidades marcadas (ops). */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
for (const p of [join(root, ".env.local"), join(root, "apps/web/.env.local")]) {
  try {
    const raw = readFileSync(p, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.+)$/);
      if (!m) continue;
      const v = m[2].trim().replace(/^["']|["']$/g, "");
      if (m[1].startsWith("NEXT_PUBLIC")) process.env.NEXT_PUBLIC_SUPABASE_URL = v;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = v;
    }
  } catch {
    /* skip */
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const sb = createClient(url, key);

const { count: opp } = await sb
  .from("listings")
  .select("id", { count: "exact", head: true })
  .eq("status", "active")
  .eq("operation", "sale")
  .eq("is_opportunity", true);

const { count: notary } = await sb
  .from("notary_stats")
  .select("postal_code", { count: "exact", head: true });

const { data: top } = await sb
  .from("listings")
  .select("postal_code")
  .eq("is_opportunity", true)
  .eq("status", "active")
  .limit(5000);

const byCp = {};
for (const r of top ?? []) {
  const cp = r.postal_code ?? "?";
  byCp[cp] = (byCp[cp] ?? 0) + 1;
}
const topCps = Object.entries(byCp)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12);

console.log(JSON.stringify({ opportunities: opp ?? 0, notaryRows: notary ?? 0, topCps }, null, 2));
