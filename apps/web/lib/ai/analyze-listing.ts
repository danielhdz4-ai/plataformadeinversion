import { geminiGenerateJson, listingAiGeminiSchema } from "@/lib/ai/gemini";
import {
  listingAiAnalysisSchema,
  type ListingAiAnalysis,
} from "@/lib/ai/listing-analysis-types";
import { geminiModel } from "@/lib/platform/features";

export type ListingContextForAi = {
  id: string;
  title: string | null;
  city: string | null;
  postalCode: string | null;
  price: number;
  sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sourcePortal: string | null;
  rentEst: number | null;
  roiGross: number | null;
  rentConfidence: string | null;
  comparablesCount: number | null;
  notaryPriceM2: number | null;
  notaryAvgPrice: number | null;
  listingPriceM2: number | null;
};

const SYSTEM = `Eres analista inmobiliario senior en España (buy-to-let, fiscalidad ITP/IBI, mercado local).
Responde SOLO en JSON según el esquema. Sé concreto, prudente y basado en los datos recibidos.
No inventes direcciones exactas ni prometas rentabilidades garantizadas.
Menciona incertidumbre cuando falten comparables o datos oficiales.
Idioma: español (España).`;

function buildUserPrompt(ctx: ListingContextForAi): string {
  const priceM2 =
    ctx.sqm && ctx.sqm > 0 ? Math.round(ctx.price / ctx.sqm) : ctx.listingPriceM2 ?? null;
  return [
    "Analiza esta oportunidad de inversión residencial en España:",
    JSON.stringify(
      {
        listingId: ctx.id,
        title: ctx.title,
        city: ctx.city,
        postalCode: ctx.postalCode,
        portal: ctx.sourcePortal,
        priceEur: ctx.price,
        sqm: ctx.sqm,
        pricePerSqmEur: priceM2,
        bedrooms: ctx.bedrooms,
        bathrooms: ctx.bathrooms,
        rentEstMonthlyEur: ctx.rentEst,
        grossRoiPct: ctx.roiGross,
        rentConfidence: ctx.rentConfidence,
        comparablesInModel: ctx.comparablesCount,
        notaryCpAvgPriceM2: ctx.notaryPriceM2,
        notaryCpAvgSalePrice: ctx.notaryAvgPrice,
      },
      null,
      2
    ),
    "",
    "Devuelve: puntuación global 0-100, titular, resumen, fortalezas, riesgos,",
    "previsión revalorización anual estimada (prudente), rango reforma €, estrategia recomendada.",
  ].join("\n");
}

export async function analyzeListingWithGemini(ctx: ListingContextForAi): Promise<{
  analysis: ListingAiAnalysis;
  model: string;
}> {
  const raw = await geminiGenerateJson<unknown>({
    system: SYSTEM,
    user: buildUserPrompt(ctx),
    schema: listingAiGeminiSchema as unknown as Record<string, unknown>,
  });
  const analysis = listingAiAnalysisSchema.parse(raw);
  return { analysis, model: geminiModel() };
}
