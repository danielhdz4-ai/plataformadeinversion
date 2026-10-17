import { analyzeListingWithGemini, type ListingContextForAi } from "@/lib/ai/analyze-listing";
import type { ListingAiAnalysisResponse } from "@/lib/ai/listing-analysis-types";
import { listingAiAnalysisSchema } from "@/lib/ai/listing-analysis-types";
import { serverAllowsAiAnalysis } from "@/lib/platform/features";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAppUser } from "@/lib/supabase/request-client";
import { NextResponse } from "next/server";

const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

async function loadListingContext(id: string): Promise<ListingContextForAi | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listings")
    .select(
      `
      id, title, city, postal_code, price, sqm, bedrooms, bathrooms, source_portal,
      listing_investment ( rent_est, roi_gross, rent_confidence, comparables_count )
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const inv = Array.isArray(data.listing_investment)
    ? data.listing_investment[0]
    : data.listing_investment;

  let notaryPriceM2: number | null = null;
  let notaryAvgPrice: number | null = null;
  const postal = data.postal_code as string | null;
  if (postal) {
    const { data: n } = await supabase
      .from("notary_stats")
      .select("price_m2, avg_price")
      .eq("postal_code", postal)
      .order("period", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (n) {
      notaryPriceM2 = n.price_m2 != null ? Number(n.price_m2) : null;
      notaryAvgPrice = n.avg_price != null ? Number(n.avg_price) : null;
    }
  }

  const sqm = data.sqm != null ? Number(data.sqm) : null;
  const price = Number(data.price);

  return {
    id: data.id,
    title: data.title,
    city: data.city,
    postalCode: postal,
    price,
    sqm,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    sourcePortal: data.source_portal,
    rentEst: inv?.rent_est != null ? Number(inv.rent_est) : null,
    roiGross: inv?.roi_gross != null ? Number(inv.roi_gross) : null,
    rentConfidence: inv?.rent_confidence ?? null,
    comparablesCount: inv?.comparables_count != null ? Number(inv.comparables_count) : null,
    notaryPriceM2,
    notaryAvgPrice,
    listingPriceM2: sqm && sqm > 0 ? price / sqm : null,
  };
}

async function readCache(listingId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listing_ai_insights")
    .select("analysis, model, updated_at")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (error || !data) return null;
  const age = Date.now() - new Date(data.updated_at as string).getTime();
  if (age > CACHE_MAX_AGE_MS) return null;
  const parsed = listingAiAnalysisSchema.safeParse(data.analysis);
  if (!parsed.success) return null;
  return {
    analysis: parsed.data,
    model: data.model as string,
    generatedAt: data.updated_at as string,
  };
}

async function writeCache(listingId: string, analysis: unknown, model: string) {
  const supabase = createAdminClient();
  await supabase.from("listing_ai_insights").upsert(
    {
      listing_id: listingId,
      analysis,
      model,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "listing_id" }
  );
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAppUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  if (!serverAllowsAiAnalysis()) {
    return NextResponse.json(
      { premiumRequired: true, error: "Análisis IA disponible en Premium" },
      { status: 402 }
    );
  }

  const cached = await readCache(id);
  if (cached) {
    const body: ListingAiAnalysisResponse = {
      analysis: cached.analysis,
      cached: true,
      model: cached.model,
      generatedAt: cached.generatedAt,
    };
    return NextResponse.json(body);
  }

  return NextResponse.json({ cached: false, analysis: null });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAppUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  if (!serverAllowsAiAnalysis()) {
    return NextResponse.json(
      { premiumRequired: true, error: "Análisis IA disponible en Premium" },
      { status: 402 }
    );
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  if (!force) {
    const cached = await readCache(id);
    if (cached) {
      return NextResponse.json({
        analysis: cached.analysis,
        cached: true,
        model: cached.model,
        generatedAt: cached.generatedAt,
      } satisfies ListingAiAnalysisResponse);
    }
  }

  const ctxListing = await loadListingContext(id);
  if (!ctxListing) {
    return NextResponse.json({ error: "Listing no encontrado" }, { status: 404 });
  }

  try {
    const { analysis, model } = await analyzeListingWithGemini(ctxListing);
    await writeCache(id, analysis, model).catch(() => {});
    const generatedAt = new Date().toISOString();
    return NextResponse.json({
      analysis,
      cached: false,
      model,
      generatedAt,
    } satisfies ListingAiAnalysisResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error IA";
    const status = msg.includes("GEMINI_API_KEY") ? 503 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
