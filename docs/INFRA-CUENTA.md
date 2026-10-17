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

- Repo remoto (canónico): https://github.com/danielhdz4-ai/plataformadeinversion (privado).
- Vercel: **`danielhdz4-ais-projects/plataformadeinversion`** — prod https://plataformadeinversion-three.vercel.app (Git conectado a repo canónico).
- Secrets Actions (fase scrapers/enrich): `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, etc.

## CLI en máquina de desarrollo

| Herramienta | Estado típico | Acción agente |
|-------------|---------------|---------------|
| `gh` | Debe operar como **`danielhdz4-ai`**. Si solo aparece `danielhdz-ai` en `gh api user`, no puede crear repos en `danielhdz4-ai` hasta `gh auth login` en esa cuenta (único paso que puede requerir navegador). |
| `vercel` | Alinear con **`danielhdz4-ai`** (`vercel login` / switch team) antes de deploy. |
| `supabase` | `supabase link --project-ref bwxyskymbgyaidhubhnt` tras login CLI. |

Repo Git objetivo: **`https://github.com/danielhdz4-ai/plataformadeinversion`** (privado).

**Checklist de conexiones (Supabase schema, Vercel env, GitHub secrets):** ver **`docs/CONEXIONES.md`**.
