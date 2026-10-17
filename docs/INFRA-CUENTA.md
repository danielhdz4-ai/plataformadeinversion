# Infra y cuenta — Plataforma de inversión

> **No incluir secretos en este archivo.** Claves en `.env.local` (local) y en Vercel / GitHub Secrets (remoto).

## Identidad

| Servicio | Cuenta / scope |
|----------|----------------|
| GitHub | `danielhdz4-ai` |
| Vercel | Team/usuario `danielhdz4-ai` (Hobby) |
| Supabase | Org `plataformadeinversion` |

## Supabase (producción / dev)

| Campo | Valor |
|-------|--------|
| Project ref | `bwxyskymbgyaidhubhnt` |
| URL | `https://bwxyskymbgyaidhubhnt.supabase.co` |
| Región | `eu-west-1` (West EU — Ireland) |

**Claves:** Dashboard → Project Settings → API. En app usar `NEXT_PUBLIC_SUPABASE_ANON_KEY`; jobs/Actions usar `SUPABASE_SERVICE_ROLE_KEY` solo en servidor/secrets.

**CLI:** `supabase link --project-ref bwxyskymbgyaidhubhnt`

## Vercel

- Proyecto previsto: `plataformadeinversion` (o nombre del monorepo `apps/web`).
- Variables mínimas (cuando exista Next.js): ver `.env.example`.

## GitHub

- Repo remoto: `danielhdz4-ai/plataformadeinversion` (privado).
- Secrets Actions (fase scrapers/enrich): `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, etc.

## CLI en máquina de desarrollo

Si `gh auth status` o `vercel whoami` no muestran `danielhdz4-ai`, el agente debe alinear sesión antes de push/deploy (sin molestar al usuario salvo login interactivo imposible).
