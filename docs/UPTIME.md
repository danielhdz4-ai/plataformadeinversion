# Disponibilidad (Vercel + Supabase)

## Endpoints de monitorización

| URL | Uso |
|-----|-----|
| `GET /api/ping` | Solo Vercel (200 = front vivo) |
| `GET /api/health` | Vercel + Supabase (200 y `ok: true` = plataforma sana) |

Producción: https://plataformadeinversion-three.vercel.app

## Latido automático (gratis)

1. **Vercel Cron** `GET /api/cron/platform-keepalive` cada **4 h**  
   - Requiere `CRON_SECRET` en Vercel (Vercel envía `Authorization: Bearer …`).  
   - Toca Supabase (`listings` count) para reducir pausas por inactividad.

2. **GitHub Actions** `platform-uptime-check.yml` cada **2 h**  
   - Llama `/api/ping` y `/api/health` en prod.  
   - Si falla, email con **Resend** (`OPS_ALERT_EMAIL`, `RESEND_API_KEY` en GitHub Secrets).

## Monitor externo opcional (UptimeRobot, Better Stack, etc.)

- URL: `https://plataformadeinversion-three.vercel.app/api/health`
- Esperar: HTTP **200** y cuerpo JSON con `"ok":true`
- Intervalo: 5–15 min

## Si `ok: false` o DNS de Supabase no resuelve

El front puede cargar pero la BD está caída (proyecto Supabase pausado/eliminado o env vars incorrectas).

1. Dashboard Supabase → restaurar proyecto o actualizar ref.
2. Vercel → Environment Variables → `NEXT_PUBLIC_SUPABASE_URL`, claves API.
3. Redeploy.