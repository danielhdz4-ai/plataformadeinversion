import { geminiModel } from "@/lib/platform/features";

type GenerateJsonInput = {
  system: string;
  user: string;
  schema: Record<string, unknown>;
};

export async function geminiGenerateJson<T>(input: GenerateJsonInput): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY no configurada");
  }

  const model = geminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    systemInstruction: { parts: [{ text: input.system }] },
    contents: [{ role: "user", parts: [{ text: input.user }] }],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseSchema: input.schema,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini: respuesta vacía");
  return JSON.parse(text) as T;
}

/** JSON Schema para responseSchema de Gemini (subset soportado). */
export const listingAiGeminiSchema = {
  type: "object",
  properties: {
    globalScore: { type: "number" },
    headline: { type: "string" },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    revaluation: {
      type: "object",
      properties: {
        horizonYears: { type: "integer" },
        annualPctEstimate: { type: "number" },
        rationale: { type: "string" },
      },
      required: ["horizonYears", "annualPctEstimate", "rationale"],
    },
    renovation: {
      type: "object",
      properties: {
        estimateEurLow: { type: "number" },
        estimateEurHigh: { type: "number" },
        scope: { type: "string" },
      },
      required: ["estimateEurLow", "estimateEurHigh", "scope"],
    },
    strategy: {
      type: "string",
      enum: ["buy_to_let", "airbnb", "flip", "hold", "pass"],
    },
    strategyNote: { type: "string" },
  },
  required: [
    "globalScore",
    "headline",
    "summary",
    "strengths",
    "risks",
    "revaluation",
    "renovation",
    "strategy",
    "strategyNote",
  ],
} as const;
