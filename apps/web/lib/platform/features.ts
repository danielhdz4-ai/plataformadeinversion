/** Modelo Gemini por defecto (override con GEMINI_MODEL). */
export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

/** Si el modelo configurado devuelve 404, probar estos (Google retira 2.0-flash, etc.). */
export function geminiModelFallbacks(): string[] {
  const primary = geminiModel();
  const chain = [
    primary,
    "gemini-2.5-flash",
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
  ];
  return [...new Set(chain.filter(Boolean))];
}

/** Servidor: bloquear IA solo si AI_PREMIUM_GATE=1 (beta abierta por defecto). */
export function serverAllowsAiAnalysis(): boolean {
  return process.env.AI_PREMIUM_GATE !== "1";
}

/** Cliente: mostrar paywall si NEXT_PUBLIC_AI_PREMIUM_GATE=1 */
export function isAiPremiumGated(): boolean {
  return process.env.NEXT_PUBLIC_AI_PREMIUM_GATE === "1";
}
