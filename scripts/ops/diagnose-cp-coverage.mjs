/**
 * Diagnóstico de cobertura por CP: qué hay en BD, qué pasa filtros y por qué.
 * Uso: CP=28031 node --env-file=.env.local scripts/ops/diagnose-cp-coverage.mjs
 */
import { getSupabase } from "../scrapers/lib/env.mjs";
import { isPlausibleMonthlyRent } from "../scrapers/lib/rent-plausible.mjs";

const CP = (process.env.CP ?? process.argv[2] ?? "28031").replace(/\D/g, "").slice(0, 5);
const supabase = getSupabase();
const freshSince = new Date(Date.now() - 14 * 864e5).toISOString();

async function count(table, filters) {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  for (const [op, col, val] of filters) q = q[op](col, val);
  const { count: n, error } = await q;
  if (error) return `ERR ${error.message}`;
  return n ?? 0;
}

console.log(`CP ${CP} · ventana fresca desde ${freshSince}`);
console.log("venta activa                ", await count("listings", [["eq", "postal_code", CP], ["eq", "operation", "sale"], ["eq", "status", "active"]]));
console.log("venta activa última 14 d    ", await count("listings", [["eq", "postal_code", CP], ["eq", "operation", "sale"], ["eq", "status", "active"], ["gte", "scraped_at", freshSince]]));
console.log("venta residencial 14 d      ", await count("listings", [["eq", "postal_code", CP], ["eq", "operation", "sale"], ["eq", "status", "active"], ["gte", "scraped_at", freshSince], ["not", "property_kind", "is", null]]));
console.log("is_opportunity = true       ", await count("listings", [["eq", "postal_code", CP], ["eq", "operation", "sale"], ["eq", "status", "active"], ["eq", "is_opportunity", true]]));
console.log("alquiler activo 45 d (ciudad Madrid)", await count("listings", [["eq", "operation", "rent"], ["eq", "status", "active"], ["gte", "last_seen_at", new Date(Date.now() - 45 * 864e5).toISOString()], ["ilike", "city", "%madrid%"]]));

const { data: rows } = await supabase
  .from("listings")
  .select("id,title,price,sqm,bedrooms,source_portal,scraped_at,property_kind,is_opportunity,listing_investment(rent_est,roi_gross,rent_confidence)")
  .eq("postal_code", CP)
  .eq("operation", "sale")
  .eq("status", "active")
  .gte("scraped_at", freshSince)
  .limit(400);

console.log(`\nmuestra fresca: ${rows?.length ?? 0}`);
const kinds = {};
let withRoi = 0;
let withInv = 0;
let highRoi = 0;
for (const r of rows ?? []) {
  kinds[r.property_kind ?? "null"] = (kinds[r.property_kind ?? "null"] ?? 0) + 1;
  const inv = Array.isArray(r.listing_investment) ? r.listing_investment[0] : r.listing_investment;
  if (inv) withInv++;
  const roi = Number(inv?.roi_gross ?? NaN);
  if (Number.isFinite(roi)) {
    withRoi++;
    if (roi >= 9) highRoi++;
  }
}
console.log("property_kind", kinds);
console.log("con listing_investment", withInv, "· con roi", withRoi, "· roi>=9 (candidato rápido)", highRoi);

const rents = (rows ?? [])
  .map((r) => Number((Array.isArray(r.listing_investment) ? r.listing_investment[0] : r.listing_investment)?.rent_est))
  .filter((n) => Number.isFinite(n));
if (rents.length) {
  const s = rents.sort((a, b) => a - b);
  console.log("rent_est p10/p50/p90", s[Math.floor(s.length * 0.1)], s[Math.floor(s.length * 0.5)], s[Math.floor(s.length * 0.9)]);
}
console.log("ejemplos:");
for (const r of (rows ?? []).slice(0, 10)) {
  const inv = Array.isArray(r.listing_investment) ? r.listing_investment[0] : r.listing_investment;
  console.log(" ", r.source_portal, "price=" + r.price, "sqm=" + r.sqm, "beds=" + r.bedrooms, "rent=" + inv?.rent_est, "roi=" + inv?.roi_gross, "conf=" + inv?.rent_confidence, (r.title ?? "").slice(0, 40));
}
