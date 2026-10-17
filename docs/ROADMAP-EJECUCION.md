# Roadmap de ejecución — cuellos de botella (B1→B12)

> **Stack:** Vercel + Supabase + GitHub Actions · **Cuenta:** `danielhdz4-ai`  
> **Pipeline:** Scrape → Geocode → ROI precompute → Mapa/Scan

## Fase 0 — Fundamentos (hecho / en curso)

| Paso | Entregable | B |
|------|------------|---|
| 0.1 | Monorepo, Supabase PostGIS, RLS open-access | — |
| 0.2 | Mapa nacional, scan wizard, resultados | B9 parcial |
| 0.3 | Geocode CP España (`geocode-spain.ts`) | B2 parcial |
| 0.4 | Filtros scan + encuadre mapa por polígono | B9, B10 |

## Fase 1 — Datos y cobertura (B1, B4, B5)

| Paso | Entregable | Estado |
|------|------------|--------|
| 1.1 | Kelify scroll + 220 listings/ciudad | ✅ código |
| 1.2 | Tier1 2×/día pisos + kelify (`MAX_LISTINGS=220`) | ✅ workflows |
| 1.3 | Tier2 rotación + kelify por ciudad | ✅ batch |
| 1.4 | `coverage_regions` + leyenda mapa | ✅ API + UI |
| 1.5 | `user_map_requests` + botón “Solicitar datos” | ✅ migración + API |
| 1.6 | `/api/platform/scrape-status` | ✅ |

**DoD B1:** Tier1 ≥800 ventas/ciudad; Valencia z=12 ≥40 pins (medir tras scrapes).

## Fase 2 — Geolocalización (B2)

| Paso | Entregable | Estado |
|------|------------|--------|
| 2.1 | Tablas `geocode_cache`, `geocode_pending` | ✅ migración |
| 2.2 | Job `geocode-batch.mjs` (Nominatim 1/s, max 200) | ✅ |
| 2.3 | Workflow `geocode-batch.yml` diario | ✅ |
| 2.4 | Waterfall G2 Catastro (`geocode-catastro-refine.mjs`) | ✅ |
| 2.5 | Ocultar pin ROI si `geocode_quality >= 5` en zoom≥14 | ✅ mapa |

**DoD B2:** ≥85 % activos Tier1 con `geocode_quality ≤ 3`.

## Fase 3 — ROI y scan (B3, B8, B9, B11)

| Paso | Entregable | Estado |
|------|------------|--------|
| 3.1 | `precompute-roi.yml` tras scrapes | ✅ existente |
| 3.2 | Excluir `property_kind` no residencial en scan | ✅ |
| 3.3 | Scan `/run` async (`after()` + 202) | ✅ |
| 3.4 | Resultados filtran siempre precio/dormitorios | ✅ |
| 3.5 | Pins por `rent_confidence` (CSS) | ✅ |
| 3.6 | ITP por CCAA (`tax_rules` en summary) | ✅ |

**DoD B3/B9:** Scan UI no bloquea; p95 <5 s lectura resultados precomputados.

## Fase 4 — UX mapa y API (B10, B12)

| Paso | Entregable | Estado |
|------|------------|--------|
| 4.1 | Debounce bbox 300 ms | ✅ |
| 4.2 | Rate limit `/api/map/*`, `/api/scans` | ✅ middleware |
| 4.3 | `SavedListingsProvider` (1 GET /api/saved) | ✅ |
| 4.4 | Frescura `scraped_at` en ficha | ✅ badge |
| 4.5 | Dedup cross-portal (`dedup-cross-portal.mjs`) | ✅ heurística CP/precio/m² |

## Fase 5 — Escala y calidad (B6, B7 completo, legal)

| Paso | Entregable | Estado |
|------|------------|--------|
| 5.1 | Dedup por RC + hash dirección | 🔜 (mejora sobre heurística) |
| 5.2 | `rent_benchmarks` por ciudad (R0) | pendiente |
| 5.3 | Resend alertas scrape fallido | pendiente |
| 5.4 | Purga `archived` >90 días | ✅ `purge-archived-listings.mjs` |
| 5.5 | `refresh-coverage-counts` + fulfill map requests | ✅ jobs + workflow |

## Operación continua

1. Push workflows a GitHub (PAT scope `workflow`).
2. `supabase db push` migración `20251017180000_*`.
3. Cron: tier1 → precompute-roi → geocode-batch.
4. Monitor: `/api/platform/scrape-status` + inventario en header.

---

**Última actualización:** 2026-10-17 — implementación agente Fase 1–4 en repo.
