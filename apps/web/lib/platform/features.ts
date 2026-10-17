/** Modelo Gemini por defecto (override con GEMINI_MODEL). */
export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
}

/** Servidor: bloquear IA solo si AI_PREMIUM_GATE=1 (beta abierta por defecto). */
export function serverAllowsAiAnalysis(): boolean {
  return process.env.AI_PREMIUM_GATE !== "1";
}

/** Cliente: mostrar paywall si NEXT_PUBLIC_AI_PREMIUM_GATE=1 */
export function isAiPremiumGated(): boolean {
  return process.env.NEXT_PUBLIC_AI_PREMIUM_GATE === "1";
}
