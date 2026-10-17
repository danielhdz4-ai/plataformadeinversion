import { z } from "zod";

export const listingAiAnalysisSchema = z.object({
  globalScore: z.number().min(0).max(100),
  headline: z.string(),
  summary: z.string(),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  revaluation: z.object({
    horizonYears: z.number().int().positive(),
    annualPctEstimate: z.number(),
    rationale: z.string(),
  }),
  renovation: z.object({
    estimateEurLow: z.number().nonnegative(),
    estimateEurHigh: z.number().nonnegative(),
    scope: z.string(),
  }),
  strategy: z.enum(["buy_to_let", "airbnb", "flip", "hold", "pass"]),
  strategyNote: z.string(),
});

export type ListingAiAnalysis = z.infer<typeof listingAiAnalysisSchema>;

export type ListingAiAnalysisResponse = {
  analysis: ListingAiAnalysis | null;
  cached?: boolean;
  model?: string;
  generatedAt?: string;
  premiumRequired?: boolean;
  error?: string;
};
