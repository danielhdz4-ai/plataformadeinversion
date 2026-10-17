# Conexiones para dejar la plataforma operativa

Estado objetivo: **https://plataformadeinversion-three.vercel.app** con mapa, scan demo Barcelona y datos en Supabase.

## 1. Supabase — esquema y seed (obligatorio, una vez)

El proyecto remoto **`bwxyskymbgyaidhubhnt`** debe tener aplicadas las migraciones. Sin esto el mapa no muestra pins y el scan falla.

**Manual (1 clic):** copiar y ejecutar [`supabase/bootstrap-completo.sql`](../supabase/bootstrap-completo.sql) en el [SQL Editor](https://supabase.com/dashboard/project/bwxyskymbgyaidhubhnt/sql/new). Guía: [`docs/SUPABASE-SQL.md`](SUPABASE-SQL.md).

**Opción A — CLI (recomendada)**

1. Cuenta Supabase org `plataformadeinversion`, proyecto ref `bwxyskymbgyaidhubhnt`.
2. En terminal (cuenta con acceso al proyecto):
   ```bash
   supabase login
   supabase link --project-ref bwxyskymbgyaidhubhnt
   supabase db push
   ```
3. Comprobar: `GET /api/health` → `"schemaReady": true`, `"listingsCount": 40` (demo).

**Opción B — URI directa**

1. Dashboard → **Database** → **Connect** → copiar **Session pooler** URI.
2. Local (no commitear la URI):
   ```bash
   npm install postgres
   set SUPABASE_DB_URL=postgresql://...
   node scripts/db-apply.mjs
   ```

**Opción C — GitHub Actions**

Añadir secrets en `danielhdz4-ai/plataformadeinversion`:

| Secret | Origen |
|--------|--------|
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access tokens |
| `SUPABASE_DB_PASSWORD` | Database password del proyecto |

Ejecutar workflow **Supabase db push** (`workflow_dispatch`).

---

## 2. Vercel — variables de entorno

Proyecto: **`danielhdz4-ais-projects/plataformadeinversion`**.

| Variable | Valor | Notas |
|----------|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://bwxyskymbgyaidhubhnt.supabase.co` | Ya configurada |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | Ya configurada |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role | Solo servidor; ya configurada |
| `NEXT_PUBLIC_APP_NAME` | Plataforma de inversión | |
| `NEXT_PUBLIC_SITE_URL` | https://plataformadeinversion-three.vercel.app | |
| `NEXT_PUBLIC_DEMO_MODE` | `1` | Banner demo |
| `OPEN_ACCESS` | `1` | APIs sin login (temporal) |
| `NEXT_PUBLIC_OPEN_ACCESS` | `1` | Entrada directa a `/app` |
| `OPEN_ACCESS_USER_ID` | `00000000-0000-4000-8000-000000000001` | Tras migración open_access |
| `CRON_SECRET` | string aleatorio largo | Jobs `/api/scans/.../run` vía Actions |

Tras cambiar env: **Redeploy** production.

---

## 3. GitHub — repo y CI

| Conexión | Detalle |
|----------|---------|
| **Remote** | https://github.com/danielhdz4-ai/plataformadeinversion |
| **Cuenta CLI** | `gh auth login` como **`danielhdz4-ai`** (no `danielhdz-ai`) |
| **Vercel ↔ GitHub** | Integración en team `danielhdz4-ais-projects`; deploy en push a `main` |

**Secrets Actions** (scrapers y DB):

| Secret | Uso |
|--------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Jobs en `scripts/jobs/` |
| `SUPABASE_SERVICE_ROLE_KEY` | Escritura listings / scrape_runs |
| `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` | Workflow db push |
| `CRON_SECRET` | Igual que en Vercel (opcional, crons futuros) |

Workflows activos:

- `CI` — build en PR/push
- `Scrape demo Barcelona` — cada 12 h (marca cobertura; datos demo vienen del seed SQL)
- `Supabase db push` — manual

---

## 4. Comprobaciones rápidas

1. **Health:** https://plataformadeinversion-three.vercel.app/api/health  
   - `schemaReady: true`, `listingsCount > 0`
2. **Mapa:** https://plataformadeinversion-three.vercel.app/app/scan/nuevo  
   - MapLibre + pins verdes al mover el mapa (Barcelona).
3. **Scan:** wizard → Buscar oportunidades → lista con ROI.

---

## 5. Pendiente de producto (no bloquea demo)

| Conexión | Cuándo |
|----------|--------|
| **Resend** + dominio verificado | Emails “scan terminado” |
| **Scrapers reales** (kelify / pisos.com) | Tras parsers en Actions |
| **Dominio propio** | Sustituir `*.vercel.app` |
| **Quitar acceso libre** | `OPEN_ACCESS=0` + login Supabase |

---

## Cuentas canónicas

| Servicio | Cuenta |
|----------|--------|
| GitHub / Vercel | `danielhdz4-ai` |
| Supabase org | `plataformadeinversion` |

Detalle URLs: `docs/INFRA-CUENTA.md`.
