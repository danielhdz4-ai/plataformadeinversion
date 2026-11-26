/** Espejo de apps/web/lib/listing/opportunity-metrics + seller-kind + qualify (jobs Node). */

const BANK_PORTALS = new Set(["hipoges", "solvia"]);
const AUCTION_RE = /\b(subasta|puja|judicial|remate|auction)\b/i;
const BANK_RE = /\b(banco|entidad|hipoteca|activo\s+bancario|npl|hipoges|solvia|sareb)\b/i;
const PRIVATE_RE = /\b(particular|propietario|sin\s+comisi[oó]n\s+de\s+comprador)\b/i;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function classifySellerKind({ sourcePortal, title, sourceUrl }) {
  const portal = (sourcePortal ?? "").toLowerCase();
  const text = `${title ?? ""} ${sourceUrl ?? ""}`;
  if (AUCTION_RE.test(text)) return "auction";
  if (BANK_PORTALS.has(portal) || BANK_RE.test(text)) return "bank";
  if (PRIVATE_RE.test(text)) return "private";
  if (portal && portal !== "unknown") return "agency";
  return "unknown";
}

function scrapedAgeDays(scrapedAt) {
  if (!scrapedAt) return null;
  const t = Date.parse(scrapedAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

export function resolveValuationFromNotary(price, sqm, notary) {
  if (!notary) {
    return { valuationMid: null, discountPct: null, vsCpPct: null, confidence: "low" };
  }
  const cpM2 = notary.price_m2 != null ? Number(notary.price_m2) : null;
  const avgPrice = notary.avg_price != null ? Number(notary.avg_price) : null;
  const avgSurface = notary.avg_surface != null ? Number(notary.avg_surface) : null;
  const ops = notary.operations_count != null ? Number(notary.operations_count) : null;
  const esEstimado = Boolean(notary.es_estimado);

  let valuationMid = null;
  let confidence = "low";

  if (avgPrice > 0 && sqm != null && sqm > 0 && avgSurface > 0) {
    valuationMid = avgPrice * (sqm / avgSurface);
    confidence = esEstimado ? "medium" : "high";
  } else if (cpM2 != null && sqm != null && sqm > 0) {
    valuationMid = cpM2 * sqm;
    confidence = ops != null && ops >= 20 ? "medium" : "low";
  } else if (avgPrice > 0) {
    valuationMid = avgPrice;
    confidence = "low";
  }

  let listingPriceM2 = sqm != null && sqm > 0 ? price / sqm : null;
  let vsCpPct =
    listingPriceM2 != null && cpM2 != null && cpM2 > 0
      ? ((listingPriceM2 - cpM2) / cpM2) * 100
      : null;

  if (valuationMid == null || !Number.isFinite(valuationMid) || valuationMid <= 0) {
    return { valuationMid: null, discountPct: null, vsCpPct, confidence: "low" };
  }

  let discountPct = Math.round(((valuationMid - price) / valuationMid) * 1000) / 10;
  if (confidence === "low" && (discountPct > 28 || valuationMid > price * 1.75)) {
    return { valuationMid: null, discountPct: null, vsCpPct, confidence: "low" };
  }
  if (confidence !== "high" && discountPct > 42) {
    return { valuationMid: null, discountPct: null, vsCpPct, confidence };
  }

  return {
    valuationMid: Math.round(valuationMid),
    discountPct,
    vsCpPct,
    confidence,
  };
}

export function computeOpportunityScore(parts) {
  let score = 0;
  let hasSignal = false;
  const { discountPct, grossRoiPct, vsCpPct, scrapedAgeDays: age, rentConfidence } = parts;

  if (discountPct != null) {
    hasSignal = true;
    score += clamp(discountPct, -15, 35) * 1.1;
  }
  if (grossRoiPct != null && grossRoiPct > 0) {
    hasSignal = true;
    score += clamp(grossRoiPct, 0, 18) * 2.2;
  }
  if (vsCpPct != null && vsCpPct < 0) {
    hasSignal = true;
    score += clamp(-vsCpPct, 0, 25) * 0.8;
  }
  if (age != null) {
    hasSignal = true;
    if (age <= 7) score += 12;
    else if (age <= 21) score += 6;
    else if (age <= 45) score += 1;
    else if (age <= 90) score -= 8;
    else if (age <= 180) score -= 14;
    else score -= 22;
  }
  const conf = String(rentConfidence ?? "").toLowerCase();
  if (conf === "high" || conf === "alta") score += 8;
  else if (conf === "medium" || conf === "media") score += 4;

  if (!hasSignal) return null;
  return clamp(Math.round(score), 0, 100);
}

export function computeListingOpportunity(listing, notary) {
  const price = Number(listing.price);
  const sqm = listing.sqm != null ? Number(listing.sqm) : null;
  const inv = listing.listing_investment;
  const roi = inv?.roi_gross != null ? Number(inv.roi_gross) : null;
  const val = resolveValuationFromNotary(price, sqm, notary);
  const age = scrapedAgeDays(listing.scraped_at);
  const sellerKind = classifySellerKind({
    sourcePortal: listing.source_portal,
    title: listing.title,
    sourceUrl: listing.source_url,
  });
  const opportunityScore = computeOpportunityScore({
    discountPct: val.discountPct,
    grossRoiPct: roi,
    vsCpPct: val.vsCpPct,
    scrapedAgeDays: age,
    rentConfidence: inv?.rent_confidence ?? null,
  });

  return {
    sellerKind,
    opportunityScore,
    discountPct: val.discountPct,
    valuationMid: val.valuationMid,
    valuationConfidence: val.confidence,
    roi,
  };
}

export function qualifiesAsOpportunity(metrics, grossRoiPct, price) {
  const score = metrics.opportunityScore;
  const disc = metrics.discountPct;
  const roi = grossRoiPct ?? metrics.roi ?? null;
  const sellerKind = metrics.sellerKind;
  const p = price != null && Number.isFinite(Number(price)) ? Number(price) : null;

  if (score != null && score >= 58) return true;
  const valConf = metrics.valuationConfidence ?? "low";
  if (disc != null && disc >= 15 && valConf !== "low") return true;
  if (disc != null && disc >= 8 && valConf !== "low" && roi != null && roi >= 7) return true;
  if (sellerKind === "bank" && disc != null && disc >= 6) return true;
  if (sellerKind === "auction" && disc != null && disc >= 10) return true;
  if (roi != null && roi >= 12 && (disc == null || disc >= 0)) return true;

  if (p != null && p <= 60_000 && roi != null && roi >= 5.5) return true;
  if (p != null && p <= 80_000 && roi != null && roi >= 6.5) {
    if (disc != null && disc >= 4) return true;
    if (score != null && score >= 50) return true;
    if (sellerKind === "bank" && roi >= 5.5) return true;
  }

  return false;
}
