# Ops — PAT de GitHub correcto (pendiente usuario)

> **Estado 2026-11-26:** el deploy de Vercel está OK, pero el `GH_TOKEN` de `.env.local`
> (cuenta `danielhdz4-ai`) solo tiene scope **`repo`**. Por eso:

| Acción | Resultado hoy |
|--------|----------------|
| `vercel deploy` (CLI) | ✅ OK — `plataformadeinversion.vercel.app` |
| Push del repo (sin workflows) | ✅ OK |
| Push con `.github/workflows/*` | ❌ `refusing to allow a PAT ... without workflow scope` |
| `workflow_dispatch` desde la app (scrape CP / zone ingest) | ❌ 404/403 — el token no puede disparar Actions |

## Qué hace el usuario (1 minuto, no lo puede hacer el agente)

1. Abrir https://github.com/settings/tokens logueado como **`danielhdz4-ai`**.
2. Generar un **fine-grained token** con:
   - Repository access: **only select repositories → `danielhdz4-ai/plataformadeinversion`**
   - Permissions: **Contents: Read and write**, **Actions: Read and write**, **Workflows: Read and write**, **Metadata: Read**.
3. Pegarlo en `.env.local` como `GH_TOKEN=...` y **borrar la línea `# Created by Vercel CLI / VERCEL_OIDC_TOKEN`** (el CLI la reescribe solo).
4. Avisar al agente: hace `node --env-file=.env.local scripts/ops/git-push-workflows.mjs`
   y `node scripts/ops/vercel-env-sync-local.mjs` (sincroniza `GITHUB_WORKFLOW_TOKEN` en Vercel).

## Qué desbloquea

- Subir los 27 workflows (scrape CP, rural, centroides, scan-zone-ingest…) al repo canónico.
- Que la app en prod pueda lanzar `scrape-postal-code-dispatch.yml` y `scan-zone-ingest.yml`
  cuando el stock de un CP es bajo (hoy en Vercel hace el scrape corto inline y sale con timeout).

## Cuenta de Vercel

- Proyecto: `danielhdz5-ai/plataformadeinversion` (Hobby, Root Directory `apps/web`).
- Alias prod: `https://plataformadeinversion.vercel.app`.
- `GITHUB_REPOSITORY` env en Vercel = `danielhdz4-ai/plataformadeinversion` (✅ corregido).
