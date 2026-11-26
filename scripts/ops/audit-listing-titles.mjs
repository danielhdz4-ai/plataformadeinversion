import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

const { data: sales } = await supabase
  .from("listings")
  .select("id, title, price, sqm, bedrooms, city, postal_code, property_kind, geocode_quality")
  .eq("operation", "sale")
  .eq("status", "active")
  .not("geom", "is", null)
  .order("scraped_at", { ascending: false })
  .limit(3000);

const byQuality = {};
const enumTitles = [];
const nullKind = [];
for (const s of sales ?? []) {
  const q = s.geocode_quality ?? "null";
  byQuality[q] = (byQuality[q] ?? 0) + 1;
  if (/^[A-Z][A-Z_]{4,}\s*·/.test(s.title ?? "")) enumTitles.push(s.title);
  if (!s.property_kind) nullKind.push(s.id);
}
console.log("sale sample", sales?.length);
console.log("geocode_quality", byQuality);
console.log("enum titles", enumTitles.length, enumTitles.slice(0, 3));
console.log("null property_kind", nullKind.length);

const { error: enumErr } = await supabase
  .from("listings")
  .update({ title: "TMP_NOOP_TEST" })
  .eq("id", "00000000-0000-0000-0000-000000000000");
console.log("write probe (esperado no-op)", enumErr?.message ?? "ok");
