/**
 * Estima notary_stats por CP a partir de ventas activas (proxy cuando no hay penotariado).
 * No sobrescribe filas oficiales (es_estimado = false).
 */
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

const MIN_PER_CP = Math.max(4, Number(process.env.NOTARY_BOOTSTRAP_MIN_CP ?? "8"));
const PAGE = 1000;
const period = new Date().toISOString().slice(0, 7);

const supabase = createClient(url, key);

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function loadOfficialCps() {
  const official = new Set();
  const { data } = await supabase.from("notary_stats").select("postal_code, es_estimado");
  for (const r of data ?? []) {
    if (!r.es_estimado) official.add(r.postal_code);
  }
  return official;
}

async function main() {
  const official = await loadOfficialCps();
  const byCp = new Map();

  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("listings")
      .select("postal_code, price, sqm")
      .eq("operation", "sale")
      .eq("status", "active")
      .not("postal_code", "is", null)
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      const cp = String(row.postal_code).replace(/\D/g, "").slice(0, 5);
      if (cp.length !== 5) continue;
      const price = Number(row.price);
      const sqm = row.sqm != null ? Number(row.sqm) : null;
      if (!Number.isFinite(price) || price <= 0) continue;
      let bucket = byCp.get(cp);
      if (!bucket) {
        bucket = { prices: [], sqms: [], m2s: [] };
        byCp.set(cp, bucket);
      }
      bucket.prices.push(price);
      if (sqm != null && sqm >= 12 && sqm <= 600) {
        bucket.sqms.push(sqm);
        bucket.m2s.push(price / sqm);
      }
    }
    offset += data.length;
    if (data.length < PAGE) break;
  }

  const rows = [];
  const allM2 = [];
  const allPrices = [];
  const allSqm = [];

  for (const [cp, b] of byCp) {
    if (official.has(cp)) continue;
    if (b.prices.length < MIN_PER_CP) continue;
    const priceM2 = median(b.m2s);
    const avgPrice = median(b.prices);
    const avgSurface = median(b.sqms);
    if (priceM2 == null || avgPrice == null) continue;
    rows.push({
      postal_code: cp,
      period,
      price_m2: Math.round(priceM2 * 100) / 100,
      avg_price: Math.round(avgPrice),
      avg_surface: avgSurface != null ? Math.round(avgSurface) : null,
      operations_count: b.prices.length,
      es_estimado: true,
      source_url: "bootstrap:listings-median",
      raw: { source: "bootstrap-notary-from-listings", n: b.prices.length },
      scraped_at: new Date().toISOString(),
    });
    allM2.push(...b.m2s);
    allPrices.push(...b.prices);
    allSqm.push(...b.sqms);
  }

  if (allM2.length >= MIN_PER_CP && !official.has("ES000")) {
    rows.push({
      postal_code: "ES000",
      period,
      price_m2: Math.round(median(allM2) * 100) / 100,
      avg_price: Math.round(median(allPrices)),
      avg_surface: median(allSqm) != null ? Math.round(median(allSqm)) : null,
      operations_count: allPrices.length,
      es_estimado: true,
      source_url: "bootstrap:listings-national",
      raw: { source: "bootstrap-notary-from-listings", national: true },
      scraped_at: new Date().toISOString(),
    });
  }

  if (rows.length === 0) {
    console.log(JSON.stringify({ ok: true, upserted: 0 }));
    return;
  }

  const { error } = await supabase.from("notary_stats").upsert(rows, {
    onConflict: "postal_code,period",
  });
  if (error) throw error;

  console.log(
    JSON.stringify({
      ok: true,
      upserted: rows.length,
      cps: rows.length,
      period,
      skippedOfficial: official.size,
    })
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
