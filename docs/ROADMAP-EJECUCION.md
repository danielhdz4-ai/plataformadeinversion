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
| 1.7 | **Ingestión on-demand por scan** (`zone-ingest.mjs`, pisos.com forzado) | ✅ código local |
| 1.8 | Objetivo ~180 ventas en polígono + refuerzo ciudad | ✅ default |
| 1.9 | `last_seen_at`, `zone_ingest_runs`, archivar stale en polígono | ✅ migración (aplicar prod) |

**DoD B1:** Tier1 ≥800 ventas/ciudad; Valencia z=12 ≥40 pins (medir tras scrapes).  
**DoD barrio:** Scan Hortaleza 2 km → ≥100 ventas en polígono tras 1ª pasada (medir en prod).

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
| 5.1 | Dedup por RC + hash dirección | ✅ RC en `dedup-cross-portal.mjs` |
| 5.2 | `rent_benchmarks` por ciudad (R0) | ✅ migración + job + precompute |
| 5.3 | Resend alertas scrape fallido | ✅ `scrape-health-alert.yml` |
| 5.4 | Purga `archived` >90 días | ✅ `purge-archived-listings.mjs` |
| 5.5 | `refresh-coverage-counts` + fulfill map requests | ✅ jobs + workflow |

## Fase 6 — Barrio / oficial (parcial)

| Paso | Entregable | Estado |
|------|------------|--------|
| 6.1 | Tabla `census_sections` + RPC listing/bbox | ✅ migración |
| 6.2 | Seed Barcelona piloto + `import-census-seed.mjs` | ✅ |
| 6.3 | `/api/map/census-sections` | ✅ |
| 6.4 | Ficha resumen demografía INE | ✅ summary + UI |
| 6.5 | `sync-notary-tier1.yml` | ✅ (JSON por CP; fetch opcional) |
| 6.6 | Capa INE en mapa Explorar | ✅ toggle + bbox (piloto BCN) |
| 6.7 | Import geometría INE provincia completa | 🔜 |

## Fase 7 — Lanzamiento (pendiente)

| Paso | Entregable | Estado |
|------|------------|--------|
| 7.1 | Commit + push `main` (workflows + zone-ingest + migraciones) | 🔄 en curso |
| 7.1b | Workflow `scan-zone-ingest.yml` + `/api/scans/[id]/rank` | ✅ |
| 7.2 | Vercel prod con `RESEND_*`, `CRON_SECRET`, `SCAN_TARGET_IN_POLYGON` | 🔜 |
| 7.3 | Supabase prod: `rent_benchmarks`, `census_sections`, `zone_ingest` | 🔜 (SQL editor parcial) |
| 7.4 | Email scan completado (usuario marca checkbox) | ✅ código |
| 7.5 | Dominio + Resend verificado | 🔜 usuario |
| 7.6 | Legal (privacidad, cookies) | 🔜 `docs/LANZAMIENTO.md` |

## Fase 8 — Calidad datos (después del lanzamiento)

| Paso | Entregable | Estado |
|------|------------|--------|
| 8.1 | Idealista estable en ingest (Playwright / proxy) | 🔜 probes |
| 8.2 | Geocode ≥85 % Tier1 (`geocode-batch` + Catastro) | 🔜 medir |
| 8.3 | Más barrios en `zone-catalog` (ciudades medianas) | 🔜 |
| 8.4 | Habitaclia / Hipoges / Solvia en `zone-ingest` | 🔜 parcial bank cron |
| 8.5 | Dedup RC en prod (job programado) | ✅ job |

## Operación continua

1. Push workflows a GitHub (PAT scope `workflow`).
2. `supabase db push` migraciones `20251019120000`, `20251019140000`/`40100`, `20251019160000`.
3. Tras push: workflow **Import census seed** + **Precompute ROI**.
4. Cron: tier1 → precompute-roi → geocode-batch → Madrid districts 4×/día.
5. Monitor: `/api/platform/scrape-status` + aviso scan si `in_polygon_after` &lt; 100.

---

**Última actualización:** 2026-10-20 — Fase 1.7 zone-ingest + F7/F8 lanzamiento.
