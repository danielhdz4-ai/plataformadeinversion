/**
 * Rellena m²/habitaciones desde API Hipoges (campos featuresAreaConstructed, etc.).
 */
import { createClient } from "@supabase/supabase-js";
import {
  createHipogesSession,
  fetchHipogesListingPage,
  mapHipogesAsset,
  spainSaleQuery,
} from "../scrapers/lib/hipoges-api.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);
const byExternal = new Map();

let session = await createHipogesSession();
const pageSize = 40;
let page = 1;
let total = 0;

while (true) {
  let data;
  try {
    data = await fetchHipogesListingPage(session, {
      page,
      itemsPerPage: pageSize,
      query: spainSaleQuery(),
    });
  } catch {
    session = await createHipogesSession();
    data = await fetchHipogesListingPage(session, {
      page,
      itemsPerPage: pageSize,
      query: spainSaleQuery(),
    });
  }
  const rows = data.result ?? [];
  if (!rows.length) break;
  for (const raw of rows) {
    const m = mapHipogesAsset(raw);
    if (m.externalId) byExternal.set(m.externalId, m);
  }
  total = Number(data.total ?? total);
  if (page * pageSize >= total) break;
  page++;
  await new Promise((r) => setTimeout(r, 400));
}

console.log(JSON.stringify({ apiAssets: byExternal.size, pages: page }));

const { data: listings, error } = await supabase
  .from("listings")
  .select("id, source_external_id, sqm, bedrooms, bathrooms")
  .eq("source_portal", "hipoges")
  .eq("status", "active");

if (error) {
  console.error(error.message);
  process.exit(1);
}

let updated = 0;
for (const row of listings ?? []) {
  const m = byExternal.get(String(row.source_external_id));
  if (!m?.sqm) continue;
  const patch = {
    sqm: m.sqm,
    scraped_at: new Date().toISOString(),
  };
  if (m.bedrooms != null) patch.bedrooms = Number(m.bedrooms);
  if (m.bathrooms != null) patch.bathrooms = Number(m.bathrooms);
  if (row.sqm === patch.sqm && row.bedrooms === patch.bedrooms) continue;
  const { error: upErr } = await supabase.from("listings").update(patch).eq("id", row.id);
  if (!upErr) updated++;
}

console.log(JSON.stringify({ ok: true, hipogesActive: listings?.length ?? 0, updated }));
