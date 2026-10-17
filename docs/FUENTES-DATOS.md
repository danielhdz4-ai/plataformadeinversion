# De dónde salen los pisos (importante)

## Cuentas y scrapers

| Qué | ¿Hay login hoy? |
|-----|------------------|
| **Plataforma de inversión** (Supabase / `/app`) | Open access o tu usuario Supabase — **no es Kelify** |
| **pisos.com** | No — JSON-LD público |
| **kelify.com** | **Público** — listados vía HTTP + Playwright (scroll). El login web es **OAuth** (Google, etc.); email/contraseña en env **no aplica** salvo que Kelify habilite formulario clásico |

No confundir: **crear usuario en kelify.com** sirve para ver más en *su* web o cumplir sus condiciones de uso; **no sustituye** la cuenta de tu producto. Si Kelify os da API o exportación con contrato, eso iría en un conector aparte (mejor que scrape con login).

Los anuncios acaban en **tu Supabase** (`listings`), con badge `source_portal = kelify`.

| Campo | Significado |
|-------|-------------|
| `source_portal` | `kelify` o `pisos_com` |
| `source_url` | Enlace al anuncio **original** en ese portal |
| `status` | `active` = visible en mapa/scan |

## Por qué pisos.com **y** kelify.com

Según el Megaprompt (P0), **ambos** son fuentes paralelas:

- **kelify.com** — agregador orientado a particulares (prioridad producto).
- **pisos.com** — cobertura amplia del mercado (segunda fuente P0).

La plataforma **unifica** en un solo mapa/ROI; en cada ficha ves el portal de origen.

## Jobs

| Script | Fuente |
|--------|--------|
| `scripts/scrapers/kelify-sale-barcelona.mjs` | kelify (Playwright) |
| `scripts/scrapers/pisos-sale-barcelona.mjs` | pisos venta (JSON-LD) |
| `scripts/scrapers/pisos-rent-barcelona.mjs` | pisos alquiler (comparables ROI) |

Tras scrape: `scripts/jobs/precompute-roi.mjs`.
