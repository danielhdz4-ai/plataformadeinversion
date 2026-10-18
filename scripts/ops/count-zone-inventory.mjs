import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

try {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    const k = line.slice(0, i);
    let v = line.slice(i + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
} catch {
  /* env already set */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}
const sb = createClient(url, key);

async function count(label, fn) {
  const r = await fn();
  console.log(label, r.count ?? r.data?.length ?? r.error);
  return r.count ?? null;
}

await count("089xx sale active", () =>
  sb.from("listings").select("*", { count: "exact", head: true }).eq("status", "active").eq("operation", "sale").like("postal_code", "089%")
);
await count("089xx with geom", () =>
  sb
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .eq("operation", "sale")
    .like("postal_code", "089%")
    .not("geom", "is", null)
);
await count("hospitalet city", () =>
  sb.from("listings").select("*", { count: "exact", head: true }).eq("status", "active").eq("operation", "sale").ilike("city", "%hospitalet%")
);
await count("089xx 100-240k", () =>
  sb
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .eq("operation", "sale")
    .like("postal_code", "089%")
    .gte("price", 100_000)
    .lte("price", 240_000)
);

const { data: portals } = await sb
  .from("listings")
  .select("source_portal")
  .eq("status", "active")
  .eq("operation", "sale")
  .like("postal_code", "089%");
const by = {};
for (const r of portals ?? []) by[r.source_portal] = (by[r.source_portal] ?? 0) + 1;
console.log("portals 089xx", by);

const { count: noGeomNational } = await sb
  .from("listings")
  .select("*", { count: "exact", head: true })
  .eq("status", "active")
  .eq("operation", "sale")
  .is("geom", null);
console.log("national sale active sin geom", noGeomNational);

const { count: bcnCity } = await sb
  .from("listings")
  .select("*", { count: "exact", head: true })
  .eq("status", "active")
  .eq("operation", "sale")
  .or("city.ilike.%barcelona%,city.ilike.%hospitalet%,city.ilike.%badalona%,city.ilike.%santa coloma%");
console.log("metro BCN sale active (city name)", bcnCity);

const { count: bcnGeom } = await sb
  .from("listings")
  .select("*", { count: "exact", head: true })
  .eq("status", "active")
  .eq("operation", "sale")
  .or("city.ilike.%barcelona%,city.ilike.%hospitalet%")
  .not("geom", "is", null);
console.log("barcelona+hospitalet with geom", bcnGeom);

const { count: totalSale } = await sb
  .from("listings")
  .select("*", { count: "exact", head: true })
  .eq("status", "active")
  .eq("operation", "sale");
console.log("national sale active", totalSale);

const { data: hList } = await sb
  .from("listings")
  .select("id, price, bedrooms, postal_code, source_portal, geom")
  .eq("status", "active")
  .eq("operation", "sale")
  .ilike("city", "%hospitalet%")
  .limit(30);
const { data: hFull } = await sb
  .from("listings")
  .select("price, bedrooms, sqm")
  .eq("status", "active")
  .eq("operation", "sale")
  .ilike("city", "%hospitalet%");
let inBand = 0;
let inBandSqm = 0;
for (const r of hFull ?? []) {
  const p = Number(r.price);
  if (p >= 100_000 && p <= 240_000) inBand++;
  const s = r.sqm != null ? Number(r.sqm) : null;
  if (p >= 100_000 && p <= 240_000 && s != null && s >= 20 && s <= 200) inBandSqm++;
}
console.log("hospitalet counts", { total: hFull?.length, inBand, inBandSqm });

for (const cityPat of ["esplugues", "cornella", "sant joan", "sant boi"]) {
  const { count } = await sb
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .eq("operation", "sale")
    .ilike("city", `%${cityPat}%`);
  const { count: inRange } = await sb
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .eq("operation", "sale")
    .ilike("city", `%${cityPat}%`)
    .gte("price", 100_000)
    .lte("price", 240_000);
  console.log(`city ~${cityPat}`, { total: count, in100_240k: inRange });
}

console.log(
  "hospitalet sample",
  hList?.map((r) => ({
    price: r.price,
    beds: r.bedrooms,
    cp: r.postal_code,
    portal: r.source_portal,
    hasGeom: r.geom != null,
  }))
);
