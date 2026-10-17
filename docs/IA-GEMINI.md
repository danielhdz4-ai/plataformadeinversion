# Análisis IA (Google Gemini)

## Configuración

1. Crear API key en [Google AI Studio](https://aistudio.google.com/apikey) (formato habitual `AIzaSy…`, no tokens OAuth `AQ.…`).
2. Añadir en `.env.local` (raíz y/o `apps/web/.env.local`) y Vercel (solo server):
   - `GEMINI_API_KEY`
   - Opcional: `GEMINI_MODEL` (default `gemini-2.5-flash`; fallback automático a `gemini-3.8-flash` si Google retira el modelo)

## Uso en producto

- **POST** `/api/listings/[id]/ai-analysis` — genera informe (cache 7 días en `listing_ai_insights`).
- **GET** — devuelve cache si existe.
- UI: bloque en tarjetas (botón «Generar») y pestaña **Análisis IA** en ficha.

## Premium (futuro)

- `NEXT_PUBLIC_AI_PREMIUM=1` — UI y API responden 402 salvo `AI_PREMIUM_OVERRIDE=1`.
- De momento la beta deja IA **abierta** (`NEXT_PUBLIC_AI_PREMIUM=0`).

## Migración

Aplicar `supabase/migrations/20251017160000_listing_ai_insights.sql` (cache server-side).
