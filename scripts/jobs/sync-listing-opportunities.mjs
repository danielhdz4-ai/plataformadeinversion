/**
 * Marca listings activos en venta con is_opportunity + score (job nocturno / post-ROI).
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
import {
  computeListingOpportunity,
  qualifiesAsOpportunity,
} from "./lib/opportunity-score.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);
const PAGE = Math.min(500, Math.max(50, Number(process.env.OPPORTUNITY_PAGE_SIZE ?? "200")));
const maxEnv = process.env.OPPORTUNITY_SYNC_MAX;
const MAX_ROWS =
  maxEnv != null && maxEnv !== "" ? Number(maxEnv) : Number.POSITIVE_INFINITY;
const CONCURRENCY = Math.min(24, Math.max(2, Number(process.env.OPPORTUNITY_CONCURRENCY ?? "12")));
async function loadNotaryMap() {
  const map = new Map();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("notary_stats")
      .select("*")
      .range(offset, offset + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const pc = row.postal_code;
      if (pc && !map.has(pc)) map.set(pc, row);
    }
    offset += data.length;
    if (data.length < 1000) break;
  }
  return map;
}

function notaryFor(postal, map) {
  if (postal && map.has(postal)) return map.get(postal);
  return null;
}

function invRow(listing) {
  const inv = listing.listing_investment;
  if (Array.isArray(inv)) return inv[0] ?? null;
  return inv ?? null;
}

const BLOCKED_KIND = new Set(["garaje", "trastero", "local", "parking", "oficina", "nave", "terreno"]);

function isResidentialKind(kind) {
  if (!kind) return true;
  const k = String(kind).toLowerCase().trim();
  if (BLOCKED_KIND.has(k)) return false;
  if (k.includes("garaje") || k.includes("trastero") || k.includes("parking")) return false;
  return true;
}

const MAX_SCRAPED_AGE_DAYS = Number(process.env.OPPORTUNITY_MAX_AGE_DAYS ?? "28");

function listingTooOld(scrapedAt) {
  if (!scrapedAt) return true;
  const t = Date.parse(scrapedAt);
  if (!Number.isFinite(t)) return true;
  const age = Math.floor((Date.now() - t) / 86400000);
  return age > MAX_SCRAPED_AGE_DAYS;
}

async function processListing(listing, notaryMap, batchStart) {
  if (listingTooOld(listing.scraped_at)) {
    const { error } = await supabase
      .from("listings")
      .update({ is_opportunity: false, opportunity_computed_at: batchStart })
      .eq("id", listing.id);
    if (error) throw error;
    return 0;
  }
  if (!isResidentialKind(listing.property_kind)) {
    const { error } = await supabase
      .from("listings")
      .update({
        is_opportunity: false,
        opportunity_computed_at: batchStart,
      })
      .eq("id", listing.id);
    if (error) throw error;
    return 0;
  }
  const row = { ...listing, listing_investment: invRow(listing) };
  const notary = notaryFor(listing.postal_code, notaryMap);
  const computed = computeListingOpportunity(row, notary);
  const price = Number(listing.price);
  const isOpportunity = qualifiesAsOpportunity(computed, computed.roi, price);

  const payload = {
    is_opportunity: isOpportunity,
    opportunity_score: computed.opportunityScore,
    opportunity_discount_pct: computed.discountPct,
    opportunity_valuation_mid: computed.valuationMid,
    opportunity_computed_at: batchStart,
  };

  const { error } = await supabase.from("listings").update(payload).eq("id", listing.id);
  if (error) throw error;
  return isOpportunity ? 1 : 0;
}

async function runPool(items, worker) {
  let i = 0;
  let qualified = 0;
  async function next() {
    while (i < items.length) {
      const idx = i++;
      qualified += await worker(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => next()));
  return qualified;
}

async function main() {
  const batchStart = new Date().toISOString();
  console.log("sync-listing-opportunities start", batchStart);

  const notaryMap = await loadNotaryMap();
  console.log("notary CPs loaded", notaryMap.size);

  const { error: resetErr } = await supabase
    .from("listings")
    .update({ is_opportunity: false })
    .eq("operation", "sale")
    .eq("status", "active")
    .eq("is_opportunity", true);
  if (resetErr) throw resetErr;
  console.log("reset prior is_opportunity flags");

  let offset = 0;
  let processed = 0;
  let qualifiedTotal = 0;

  while (processed < MAX_ROWS) {
    const { data, error } = await supabase
      .from("listings")
      .select(
        `
        id, price, sqm, title, postal_code, source_portal, source_url, scraped_at, property_kind,
        listing_investment ( rent_est, roi_gross, rent_confidence, comparables_count )
      `
      )
      .eq("operation", "sale")
      .eq("status", "active")
      .order("scraped_at", { ascending: false })
      .range(offset, offset + PAGE - 1);

    if (error) throw error;
    if (!data?.length) break;

    const q = await runPool(data, (listing) => processListing(listing, notaryMap, batchStart));
    qualifiedTotal += q;
    processed += data.length;
    offset += data.length;
    console.log(`page ok processed=${processed} qualified+=${q}`);

    if (data.length < PAGE) break;
  }

  const { error: staleErr } = await supabase
    .from("listings")
    .update({ is_opportunity: false })
    .eq("operation", "sale")
    .eq("status", "active")
    .eq("is_opportunity", true)
    .or(`opportunity_computed_at.is.null,opportunity_computed_at.neq.${batchStart}`);
  if (staleErr) throw staleErr;

  const { count: oppAfter } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("operation", "sale")
    .eq("status", "active")
    .eq("is_opportunity", true);

  console.log(
    JSON.stringify({
      ok: true,
      processed,
      qualifiedMarked: qualifiedTotal,
      opportunitiesActive: oppAfter ?? qualifiedTotal,
      batchStart,
    })
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
