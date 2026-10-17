# Stack premium — sin demo, conectores reales

## Qué es producción ahora

| Capa | Implementación |
|------|----------------|
| **UI** | Shell premium, scan wizard, resultados list+mapa, ficha con pestañas (ROI · Catastro · Notariado · INE) |
| **Mapa** | Solo `listings.status = active` (no demo en mapa/scan) |
| **Scrape P0** | `scripts/scrapers/pisos-sale-barcelona.mjs`, `pisos-rent-barcelona.mjs` + workflows 2×/día |
| **ROI** | `scripts/jobs/precompute-roi.mjs` + workflow |
| **Catastro** | `packages/catastro-client` + batch nocturno + botón en ficha |
| **Oficial** | `scripts/jobs/sync-official.mjs` (MIVAU CSV) |
| **Notariado CP** | `scripts/jobs/sync-notary-barcelona-cp.mjs` (pipeline; sustituir ArcGIS) |

## SQL obligatorio (si ya ejecutaste bootstrap)

En Supabase SQL Editor, en este orden:

1. [`supabase/migrations/20251017140000_active_listings_only.sql`](../supabase/migrations/20251017140000_active_listings_only.sql)
2. [`supabase/archive-demo-listings.sql`](../supabase/archive-demo-listings.sql)

## Poblar inventario real

GitHub → Actions → **Scrape pisos sale Barcelona** → Run workflow  
Luego **Scrape pisos rent** y **Precompute ROI**.

Local:

```bash
pnpm install
node --env-file=.env.local scripts/scrapers/pisos-sale-barcelona.mjs
node --env-file=.env.local scripts/scrapers/pisos-rent-barcelona.mjs
node --env-file=.env.local scripts/jobs/precompute-roi.mjs
```

## GitHub Secrets (cuenta danielhdz4-ai)

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
