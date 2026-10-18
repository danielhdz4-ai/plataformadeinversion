/**
 * Detecta listing_investment desincronizado respecto al precio actual.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);
const TOL = 0.25; // % puntos

function impliedRoi(price, rent) {
  if (!price || !rent) return null;
  return ((rent * 12) / price) * 100;
}

let offset = 0;
const page = 1000;
let total = 0;
let staleRoi = 0;
let staleTime = 0;
let noInv = 0;
const worst = [];

while (true) {
  const { data: rows, error } = await supabase
    .from("listings")
    .select(
      "id, title, price, scraped_at, source_portal, listing_investment(rent_est, roi_gross, computed_at)"
    )
    .eq("operation", "sale")
    .eq("status", "active")
    .order("id")
    .range(offset, offset + page - 1);

  if (error) throw error;
  if (!rows?.length) break;

  for (const row of rows) {
    total++;
    const inv = row.listing_investment;
    const price = Number(row.price);
    if (!inv) {
      noInv++;
      continue;
    }
    const rent = Number(inv.rent_est);
    const stored = Number(inv.roi_gross);
    const fresh = impliedRoi(price, rent);
    if (fresh == null) continue;

    const delta = Math.abs(stored - fresh);
    if (delta > TOL) {
      staleRoi++;
      if (worst.length < 15) {
        worst.push({
          id: row.id,
          portal: row.source_portal,
          title: (row.title ?? "").slice(0, 50),
          price,
          rent,
          storedRoi: Math.round(stored * 100) / 100,
          freshRoi: Math.round(fresh * 100) / 100,
          delta: Math.round(delta * 100) / 100,
        });
      }
    }

    const scraped = row.scraped_at ? Date.parse(row.scraped_at) : 0;
    const computed = inv.computed_at ? Date.parse(inv.computed_at) : 0;
    if (scraped > computed + 60_000) staleTime++;
  }

  offset += rows.length;
  if (rows.length < page) break;
}

worst.sort((a, b) => b.delta - a.delta);

console.log(
  JSON.stringify(
    {
      ok: true,
      activeSales: total,
      missingInvestment: noInv,
      staleRoiCount: staleRoi,
      staleRoiPct: total ? Math.round((staleRoi / total) * 1000) / 10 : 0,
      priceNewerThanRoiCompute: staleTime,
      worstExamples: worst,
    },
    null,
    2
  )
);
