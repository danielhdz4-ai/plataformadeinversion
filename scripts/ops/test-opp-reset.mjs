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
const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function countTrue() {
  const { count, error } = await sb
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("operation", "sale")
    .eq("is_opportunity", true);
  if (error) throw error;
  return count;
}

const before = await countTrue();
console.log("before", before);

const { data: sampleBefore } = await sb
  .from("listings")
  .select("id, is_opportunity, opportunity_computed_at")
  .eq("is_opportunity", true)
  .limit(1);

console.log("sampleBefore", sampleBefore);

const { error: resetErr, count: resetCount } = await sb
  .from("listings")
  .update({ is_opportunity: false })
  .eq("operation", "sale")
  .eq("status", "active")
  .eq("is_opportunity", true)
  .select("id", { count: "exact", head: true });

console.log("resetErr", resetErr, "resetCount", resetCount);

const after = await countTrue();
console.log("after", after);

const { data: one } = await sb.from("listings").select("id").limit(1).single();
if (one?.id) {
  const { error: uErr, data: uData } = await sb
    .from("listings")
    .update({ is_opportunity: false, opportunity_computed_at: new Date().toISOString() })
    .eq("id", one.id)
    .select("id, is_opportunity, opportunity_computed_at");
  console.log("singleUpdate", uErr, uData);
}
