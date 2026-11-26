import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);
const sb = createClient(url, key);

async function count(label, q) {
  const r = await q;
  console.log(label, r.count ?? r.error?.message);
}

await count("madrid city ilike", () =>
  sb
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .eq("operation", "sale")
    .ilike("city", "%madrid%")
);
await count("28xxx cp", () =>
  sb
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .eq("operation", "sale")
    .like("postal_code", "28%")
);
await count("28xxx with geom", () =>
  sb
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .eq("operation", "sale")
    .like("postal_code", "28%")
    .not("geom", "is", null)
);
await count("national sin geom", () =>
  sb
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .eq("operation", "sale")
    .is("geom", null)
);

const { data: byPortal } = await sb
  .from("listings")
  .select("source_portal")
  .eq("status", "active")
  .eq("operation", "sale")
  .ilike("city", "%madrid%");
const m = {};
for (const r of byPortal ?? []) m[r.source_portal] = (m[r.source_portal] ?? 0) + 1;
console.log("madrid by portal", m);

// Hortaleza approx center from screenshot
const geojson = JSON.stringify({
  type: "Polygon",
  coordinates: [
    [
      [-3.655, 40.465],
      [-3.625, 40.465],
      [-3.625, 40.495],
      [-3.655, 40.495],
      [-3.655, 40.465],
    ],
  ],
});
const { data: inPoly, error: polyErr } = await sb.rpc("listings_in_polygon", { geojson });
console.log("hortaleza box in polygon", polyErr?.message ?? (inPoly?.length ?? 0));

const { count: coverageMadrid } = await sb
  .from("coverage_regions")
  .select("*", { count: "exact", head: true })
  .eq("slug", "madrid");
console.log("coverage_regions madrid row exists", coverageMadrid);

const { data: cov } = await sb.from("coverage_regions").select("slug,sale_count,rent_count").eq("slug", "madrid").maybeSingle();
console.log("coverage madrid counts", cov);
