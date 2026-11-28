# Plataforma de inversión

SaaS ROI-first para inversores inmobiliarios en España (scan + mapa + calculadora).

## Stack

- **apps/web** — Next.js 15
- **packages/roi-engine** — cálculos buy-to-let
- **Supabase** — PostGIS, Auth, RLS
- **Vercel** — hosting
- **GitHub Actions** — CI + sync datos oficiales

## Desarrollo

```bash
pnpm install
pnpm dev
```

Copia `.env.example` → `.env.local` (ver `docs/INFRA-CUENTA.md`).

Aplica migraciones: Supabase Dashboard → SQL o `supabase db push`.

Documentación de producto: `docs/MEGAPROMPT.md`.
