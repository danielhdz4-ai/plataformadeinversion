# Vercel — cuenta danielhdz5-ai

**Producción:** https://plataformadeinversion.vercel.app  

**Root Directory (obligatorio en monorepo):** `apps/web`  
**Install:** `cd ../.. && pnpm install`  
**Build:** `cd ../.. && pnpm --filter @pi/roi-engine build && pnpm --filter @pi/web build`

Si el build falla con `NEXT_NO_VERSION`, el proyecto está compilando la raíz del repo en lugar de `apps/web`.

---

# Importar `plataformadeinversion` en Vercel (cuenta danielhdz5-ai)

> La CLI de este equipo sigue autenticada como **danielhdz4-ai**. Para desplegar en **danielhdz5-ai**, importad el repo desde el dashboard o ejecutad `vercel login` con `admin.contafactu@gmail.com` y luego `vercel link`.

## 1. Dashboard → Import Project

1. Cuenta **danielhdz5-ai** (Hobby).
2. **Add New… → Project**.
3. Conectar **GitHub** `danielhdz4-ai/plataformadeinversion` (o el remoto canónico que useis).

## 2. Ajustes de monorepo (obligatorio)

| Campo | Valor |
|--------|--------|
| **Root Directory** | `apps/web` |
| **Framework Preset** | Next.js |
| **Install Command** | `cd ../.. && pnpm install` |
| **Build Command** | `cd ../.. && pnpm --filter @pi/roi-engine build && pnpm --filter @pi/web build` |

(Equivalente a `apps/web/vercel.json`.)

## 3. Variables de entorno (Production)

Mínimas para que la app arranque:

| Variable | Notas |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase **vivo** (no `bwxyskymbgyaidhubhnt`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Mismo proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `NEXT_PUBLIC_SITE_URL` | `https://<tu-proyecto>.vercel.app` tras el primer deploy |
| `OPEN_ACCESS` / `NEXT_PUBLIC_OPEN_ACCESS` | `1` si queréis /app sin login |
| `CRON_SECRET` | String largo aleatorio (crons Vercel) |
| `GITHUB_WORKFLOW_TOKEN` | PAT para disparar zone-ingest (opcional pero recomendado) |
| `GITHUB_REPOSITORY` | `danielhdz4-ai/plataformadeinversion` |

Opcional alertas: `RESEND_API_KEY`, `OPS_ALERT_EMAIL`, `EMAIL_FROM`.

## 4. Tras el deploy

- Probar: `https://<alias>/api/ping` → `ok: true`
- Probar: `https://<alias>/api/health` → `ok: true` y `reachable: true` (requiere Supabase correcto + `bootstrap-completo.sql`).

## 5. Enlazar CLI local (cuando tengáis sesión danielhdz5)

```bash
cd D:\Proyectos\plataformadeinversion
vercel login
vercel link --scope danielhdz5-ai
# Root: apps/web cuando lo pregunte, o desde apps/web según wizard
vercel env pull apps/web/.env.vercel.prod --environment=production
```

Borrar `.vercel` antiguo si apuntaba a `danielhdz4-ais-projects` y queréis un solo destino.