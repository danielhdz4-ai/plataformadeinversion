# SQL manual — Supabase

## Un solo archivo (recomendado)

1. Abre [SQL Editor](https://supabase.com/dashboard/project/bwxyskymbgyaidhubhnt/sql/new) del proyecto `bwxyskymbgyaidhubhnt`.
2. Copia **todo** el contenido de [`supabase/bootstrap-completo.sql`](../supabase/bootstrap-completo.sql).
3. Pulsa **Run**.
4. Comprueba: https://plataformadeinversion-three.vercel.app/api/health  
   - `schemaReady: true`  
   - `listingsCount: 40` (aprox.)

## Si falla el insert en `auth.users`

El resto del script puede haberse aplicado. Crea el usuario desde el dashboard (Authentication → Users → Add user) con UUID fijo `00000000-0000-4000-8000-000000000001` y email ficticio, o pide al agente que ejecute `supabase db push` con CLI.

## Migraciones por archivo (alternativa)

Orden en `supabase/migrations/`:

1. `20251017120000_init.sql`
2. `20251017120100_scan_rpc.sql`
3. `20251017120300_open_access.sql`
