import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);
const s = createClient(url, key);

for (const p of ["kelify", "pisos_com", "pisos.com", "hipoges", "solvia", "demo"]) {
  const { count } = await s
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("operation", "sale")
    .eq("status", "active")
    .eq("source_portal", p);
  console.log("active sale", p, count ?? 0);
}
const { count: kArch } = await s
  .from("listings")
  .select("id", { count: "exact", head: true })
  .eq("source_portal", "kelify")
  .eq("status", "archived");
console.log("kelify archived", kArch ?? 0);
