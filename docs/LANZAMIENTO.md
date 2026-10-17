# Playbook de lanzamiento — Plataforma de inversión

> Producto: **Plataforma de inversión**. Dominio: pendiente (`NEXT_PUBLIC_SITE_URL` cuando se compre).  
> Fuentes P0: kelify.com + pisos.com (portales de extracción, no nombre del producto).  
> Usar cuando el repo cumple **MVP-READY** (`MEGAPROMPT.md` §11).  
> El código terminado es ~40 % del camino; esto es el otro 60 % operativo y de confianza.

---

## Fase A — Producción técnica (día 1–2)

1. **Supabase producción**
   - Proyecto dedicado (no compartido).
   - `supabase db push` desde `main`.
   - Verificar extensiones: `postgis`, `uuid-ossp`.
   - Export manual SQL backup (dashboard) — única copia free.

2. **Vercel**
   - Proyecto linked; root directory `apps/web` si monorepo.
   - Variables de entorno = `.env.example` completo.
   - Primer deploy prod OK; probar `/api/health`.

3. **GitHub**
   - Secrets: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CRON_SECRET`, `RESEND_API_KEY`.
   - Ejecutar manualmente workflows: `scrape-rent`, `scrape-sale`, `precompute-roi` (crear cuando existan).
   - Confirmar listings en tabla con `geom` NOT NULL.

4. **Datos mínimos en prod**
   - Objetivo: ≥500 ventas + ≥1000 alquileres ciudad piloto **o** acuerdo explícito de lanzar con banner demo hasta completar scrape.

---

## Fase B — Dominio y correo (día 2–4)

5. **Dominio**
   - DNS → Vercel.
   - Actualizar `NEXT_PUBLIC_SITE_URL`.
   - Supabase Auth → Site URL + Redirect URLs (prod + preview si aplica).

6. **Resend**
   - Añadir dominio; SPF/DKIM.
   - `EMAIL_FROM` en dominio verificado.
   - Enviar prueba: registro + «scan completado».

---

## Fase C — Legal y contenido (día 3–5)

7. Publicar rutas legales (`MEGAPROMPT.md` §17).
8. Landing: propuesta de valor, captura mapa/scan, CTA registro.
9. Revisión humana de disclaimers (orientativo, no sustituye abogado).

---

## Fase D — Validación humana (día 5–7)

10. **Smoke test prod** — recorrido §12.1 MEGAPROMPT con cuenta nueva.
11. **Checklist §22** MEGAPROMPT completo.
12. Corregir bugs P0/P1 antes de beta.

---

## Fase E — Beta cerrada (semana 2–4)

13. Invitar 5–15 inversores / asesores conocidos.
14. Formulario feedback (Google Form / Typeform free).
15. Métricas simples (manual o PostHog free si se añade):
    - registros
    - scans completados
    - listings guardados
    - clicks «ver anuncio original»

16. Priorizar v1.1 según fricción (mapa lento, pocos comparables, etc.).

---

## Fase F — Operación rutinaria (ongoing)

| Tarea | Frecuencia |
|-------|------------|
| Revisar Actions fallidos | Diario |
| Tamaño BD Supabase | Semanal |
| Refrescar notariado / INE | Según MEGAPROMPT §20 |
| Rotar/revisar scrapers si portal cambia HTML | Cuando falle job |

---

## Fase G — Crecimiento (cuando haya tracción)

17. Segunda ciudad (mismo playbook scrape + INE provincia).
18. Alertas email (F6) como retención.
19. Stripe / planes (salir de 0 € en infra solo cuando ingresos lo justifiquen).
20. Informes PDF white-label (F7) para asesores.

---

## Definition of «lanzado»

El producto está **lanzado** cuando:

- Un usuario externo puede registrarse en prod, hacer un scan en ciudad piloto, ver ROI y abrir anuncios **sin intervención tuya**.
- Legal y email funcionan.
- Scrapers han corrido al menos **una semana** estable en prod **o** demo mode está claramente indicado.
