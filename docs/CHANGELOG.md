# Changelog

## 2026-11-26 — Deploy prod real + dispatch GitHub unificado

- **Producción Vercel:** desplegado en `danielhdz5-ai/plataformadeinversion` (`plataformadeinversion.vercel.app`), verificados `/api/ping`, `/api/health` (`db:true`, 27.073 listings) y `/api/platform/stats`.
- **Root Directory** del proyecto Vercel = `apps/web` (antes el deploy CLI desde `apps/web` fallaba con `specified Root Directory "apps/web" does not exist`).
- **Fix dispatch de Actions:** los triggers apuntaban al repo inexistente `danielhdz-ai/plataformadeinversion`. Nuevo módulo `apps/web/lib/ops/github-dispatch.server.ts` con repo canónico `CANONICAL_GITHUB_REPO` y `GITHUB_REPOSITORY` override; refactor de `trigger-cp-scrape-workflow` y `trigger-zone-ingest-workflow`.
- **Vercel env:** `GITHUB_REPOSITORY` corregido a `danielhdz4-ai/plataformadeinversion` (production).
- **git remoto:** `origin` corregido a `danielhdz4-ai/plataformadeinversion.git`; scripts de push unificados en `scripts/ops/lib/github-remote.mjs` (repo canónico + verificación de scope `workflow`).
- **Migración** `20251126120000_backfill_last_seen_at.sql`: backfill `last_seen_at = scraped_at` en listings activos legacy (pendiente de aplicar; hoy ~6.600 ventas sin `last_seen_at`).

## 2026-10-17 — F0–F5 scaffold

- Monorepo pnpm: `apps/web`, `packages/roi-engine`, `catastro-client`, `db-types`
- Migraciones Supabase (PostGIS, listings demo Barcelona, scans, RLS)
- UI: landing, login magic link, calculadora, scan wizard, guardados
- API: health, map listings, scans, listings, saved
- CI + workflow sync-official-csv
